import { eq, and, inArray } from 'drizzle-orm';
import { vocabProgress, vocabUsers, vocabStatusHistory, LEARNING_STATUS } from '../../../database/schemas/vocab';
import type { LearningStatus } from '../../../database/schemas/vocab';
import { transitionStatus, deriveFlags, isFirstInteraction, isValidAction } from '../../../utils/vocab-state-machine';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { userId, wordIds, action } = body;

  if (!userId || !Array.isArray(wordIds) || wordIds.length === 0 || !action) {
    throw createError({ statusCode: 400, message: 'userId, wordIds (array), and action are required' });
  }

  if (!isValidAction(action)) {
    throw createError({ statusCode: 400, message: 'Invalid action. Must be SET_TO_LEARN, SET_LEARNING, or SET_MASTERED' });
  }

  if (wordIds.length > 500) {
    throw createError({ statusCode: 400, message: 'Maximum 500 words per batch' });
  }

  const db = useDB();
  const now = Date.now();
  const uid = Number(userId);

  // 验证用户
  const user = await db.select().from(vocabUsers).where(eq(vocabUsers.id, uid)).limit(1);
  if (user.length === 0) throw createError({ statusCode: 404, message: 'User not found' });

  // 获取现有 progress
  const existingProgress = await db.select()
    .from(vocabProgress)
    .where(and(
      eq(vocabProgress.userId, uid),
      inArray(vocabProgress.wordId, wordIds.map(Number)),
    ));

  const progressMap = new Map(existingProgress.map(p => [p.wordId, p]));

  let updated = 0;
  const historyEntries: any[] = [];

  // better-sqlite3 事务是同步的
  db.transaction((tx) => {
    for (const wid of wordIds) {
      const wordId = Number(wid);
      const existing = progressMap.get(wordId);
      const currentStatus = (existing?.learningStatus || LEARNING_STATUS.UNREAD) as LearningStatus;
      const newStatus = transitionStatus(currentStatus, action);

      if (newStatus === currentStatus && existing) continue;

      const flags = deriveFlags(newStatus);
      const firstInteract = isFirstInteraction(currentStatus, newStatus);

      if (!existing) {
        tx.insert(vocabProgress).values({
          userId: uid,
          wordId,
          learningStatus: newStatus,
          isRead: flags.isRead,
          isMastered: flags.isMastered,
          firstInteractedAt: firstInteract ? now : null,
          masteredAt: flags.isMastered ? now : null,
        }).run();
      } else {
        const updates: any = {
          learningStatus: newStatus,
          isRead: flags.isRead,
          isMastered: flags.isMastered,
        };
        if (firstInteract && !existing.firstInteractedAt) {
          updates.firstInteractedAt = now;
        }
        if (flags.isMastered && !existing.masteredAt) {
          updates.masteredAt = now;
        }
        if (!flags.isMastered) {
          updates.masteredAt = null;
        }

        tx.update(vocabProgress)
          .set(updates)
          .where(eq(vocabProgress.id, existing.id))
          .run();
      }

      historyEntries.push({
        userId: uid,
        wordId,
        previousStatus: currentStatus,
        newStatus,
        changedAt: now,
      });
      updated++;
    }

    // 批量插入历史
    if (historyEntries.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < historyEntries.length; i += batchSize) {
        tx.insert(vocabStatusHistory).values(historyEntries.slice(i, i + batchSize)).run();
      }
    }
  });

  return { updated, total: wordIds.length };
});
