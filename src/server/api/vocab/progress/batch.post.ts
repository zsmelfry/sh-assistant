import { useDB } from '~/server/database';
import { inArray } from 'drizzle-orm';
import { vocabProgress, vocabStatusHistory, LEARNING_STATUS } from '../../../database/schemas/vocab';
import type { LearningStatus } from '../../../database/schemas/vocab';
import { transitionStatus, deriveFlags, isFirstInteraction, isValidAction } from '../../../utils/vocab-state-machine';
import { ensureVocabUser } from '../../../utils/ensure-vocab-user';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { wordIds, action } = body;

  if (!Array.isArray(wordIds) || wordIds.length === 0 || !action) {
    throw createError({ statusCode: 400, message: 'wordIds (array) and action are required' });
  }

  if (!isValidAction(action)) {
    throw createError({ statusCode: 400, message: 'Invalid action. Must be SET_TO_LEARN, SET_LEARNING, or SET_MASTERED' });
  }

  if (wordIds.length > 500) {
    throw createError({ statusCode: 400, message: 'Maximum 500 words per batch' });
  }

  const db = useDB(event);
  const username = event.context.auth?.username;
  if (!username) throw createError({ statusCode: 401, message: 'Unauthorized' });
  const vocabUserId = ensureVocabUser(db, username);
  const now = Date.now();
  const numWordIds = wordIds.map(Number);

  // 获取现有 progress
  const existingProgress = await db.select()
    .from(vocabProgress)
    .where(
      inArray(vocabProgress.wordId, numWordIds),
    );

  const progressMap = new Map(existingProgress.map(p => [p.wordId, p]));

  // 预计算：分组
  const toInsert: any[] = [];
  const toUpdate: { id: number; newStatus: LearningStatus; setFirstInteract: boolean; setMastered: boolean }[] = [];
  const historyEntries: any[] = [];

  for (const wordId of numWordIds) {
    const existing = progressMap.get(wordId);
    const currentStatus = (existing?.learningStatus || LEARNING_STATUS.UNREAD) as LearningStatus;
    const newStatus = transitionStatus(currentStatus, action);

    if (newStatus === currentStatus && existing) continue;

    const flags = deriveFlags(newStatus);
    const firstInteract = isFirstInteraction(currentStatus, newStatus);

    if (!existing) {
      toInsert.push({
        userId: vocabUserId,
        wordId,
        learningStatus: newStatus,
        isRead: flags.isRead,
        isMastered: flags.isMastered,
        firstInteractedAt: firstInteract ? now : null,
        masteredAt: flags.isMastered ? now : null,
      });
    } else {
      toUpdate.push({
        id: existing.id,
        newStatus,
        setFirstInteract: firstInteract && !existing.firstInteractedAt,
        setMastered: flags.isMastered && !existing.masteredAt,
      });
    }

    historyEntries.push({
      userId: vocabUserId,
      wordId,
      previousStatus: currentStatus,
      newStatus,
      changedAt: now,
    });
  }

  const updated = toInsert.length + toUpdate.length;
  if (updated === 0) return { updated: 0, total: wordIds.length };

  const batchSize = 500;

  db.transaction((tx: any) => {
    // 批量 INSERT 新 progress
    for (let i = 0; i < toInsert.length; i += batchSize) {
      tx.insert(vocabProgress).values(toInsert.slice(i, i + batchSize)).run();
    }

    // 批量 UPDATE：按目标状态分组，每组一条 UPDATE
    if (toUpdate.length > 0) {
      const byStatus = new Map<string, number[]>();
      for (const item of toUpdate) {
        const key = item.newStatus;
        if (!byStatus.has(key)) byStatus.set(key, []);
        byStatus.get(key)!.push(item.id);
      }

      for (const [status, ids] of byStatus) {
        const flags = deriveFlags(status as LearningStatus);
        for (let i = 0; i < ids.length; i += batchSize) {
          tx.update(vocabProgress)
            .set({
              learningStatus: status,
              isRead: flags.isRead,
              isMastered: flags.isMastered,
              masteredAt: flags.isMastered ? now : null,
            })
            .where(inArray(vocabProgress.id, ids.slice(i, i + batchSize)))
            .run();
        }
      }

      // 补充 firstInteractedAt（只对需要的记录）
      const needFirstInteract = toUpdate.filter(u => u.setFirstInteract).map(u => u.id);
      for (let i = 0; i < needFirstInteract.length; i += batchSize) {
        tx.update(vocabProgress)
          .set({ firstInteractedAt: now })
          .where(inArray(vocabProgress.id, needFirstInteract.slice(i, i + batchSize)))
          .run();
      }
    }

    // 批量 INSERT 历史
    for (let i = 0; i < historyEntries.length; i += batchSize) {
      tx.insert(vocabStatusHistory).values(historyEntries.slice(i, i + batchSize)).run();
    }
  });

  return { updated, total: wordIds.length };
});
