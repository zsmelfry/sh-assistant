import { useDB } from '~/server/database';
import { eq, and } from 'drizzle-orm';
import { vocabProgress, vocabWords, vocabUsers, vocabStatusHistory, LEARNING_STATUS } from '../../../database/schemas/vocab';
import type { LearningStatus } from '../../../database/schemas/vocab';
import { transitionStatus, deriveFlags, isFirstInteraction, isValidAction } from '../../../utils/vocab-state-machine';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { userId, wordId, action } = body;

  if (!userId || !wordId || !action) {
    throw createError({ statusCode: 400, message: 'userId, wordId, and action are required' });
  }

  if (!isValidAction(action)) {
    throw createError({ statusCode: 400, message: 'Invalid action. Must be SET_TO_LEARN, SET_LEARNING, or SET_MASTERED' });
  }

  const db = useDB();
  const now = Date.now();

  // 验证用户和单词存在
  const [user, word] = await Promise.all([
    db.select().from(vocabUsers).where(eq(vocabUsers.id, Number(userId))).limit(1),
    db.select().from(vocabWords).where(eq(vocabWords.id, Number(wordId))).limit(1),
  ]);

  if (user.length === 0) throw createError({ statusCode: 404, message: 'User not found' });
  if (word.length === 0) throw createError({ statusCode: 404, message: 'Word not found' });

  // 查找当前 progress
  const existing = await db.select()
    .from(vocabProgress)
    .where(and(
      eq(vocabProgress.userId, Number(userId)),
      eq(vocabProgress.wordId, Number(wordId)),
    ))
    .limit(1);

  const currentStatus = (existing[0]?.learningStatus || LEARNING_STATUS.UNREAD) as LearningStatus;
  const newStatus = transitionStatus(currentStatus, action);

  // 状态没有变化
  if (newStatus === currentStatus && existing.length > 0) {
    return { progress: existing[0], changed: false };
  }

  const flags = deriveFlags(newStatus);
  const firstInteraction = isFirstInteraction(currentStatus, newStatus);

  let progress;
  if (existing.length === 0) {
    // 创建新 progress
    const result = await db.insert(vocabProgress).values({
      userId: Number(userId),
      wordId: Number(wordId),
      learningStatus: newStatus,
      isRead: flags.isRead,
      isMastered: flags.isMastered,
      firstInteractedAt: firstInteraction ? now : null,
      masteredAt: flags.isMastered ? now : null,
    }).returning();
    progress = result[0];
  } else {
    // 更新已有 progress
    const updates: any = {
      learningStatus: newStatus,
      isRead: flags.isRead,
      isMastered: flags.isMastered,
    };
    if (firstInteraction && !existing[0].firstInteractedAt) {
      updates.firstInteractedAt = now;
    }
    if (flags.isMastered && !existing[0].masteredAt) {
      updates.masteredAt = now;
    }
    if (!flags.isMastered) {
      updates.masteredAt = null;
    }

    const result = await db.update(vocabProgress)
      .set(updates)
      .where(eq(vocabProgress.id, existing[0].id))
      .returning();
    progress = result[0];
  }

  // 记录状态变更历史
  await db.insert(vocabStatusHistory).values({
    userId: Number(userId),
    wordId: Number(wordId),
    previousStatus: currentStatus,
    newStatus,
    changedAt: now,
  });

  return { progress, changed: true };
});
