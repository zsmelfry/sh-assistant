import { useDB } from '~/server/database';
import {
  habits, checkins,
  vocabStatusHistory, vocabProgress, vocabWords, vocabUsers, vocabSettings,
  reviewLogs, srsCards, definitions, studySessions,
  llmProviders,
} from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  // habit-tracker
  await db.delete(checkins);
  await db.delete(habits);
  // SRS 子表 (先删子表: reviewLogs → srsCards → definitions, studySessions)
  await db.delete(reviewLogs);
  await db.delete(srsCards);
  await db.delete(definitions);
  await db.delete(studySessions);
  // vocab-tracker (顺序: 先删子表)
  await db.delete(vocabStatusHistory);
  await db.delete(vocabProgress);
  await db.delete(vocabWords);
  await db.delete(vocabUsers);
  await db.delete(vocabSettings);
  // LLM
  await db.delete(llmProviders);
  return { success: true };
});
