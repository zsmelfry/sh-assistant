import { useDB } from '~/server/database';
import {
  habits, checkins,
  vocabStatusHistory, vocabProgress, vocabWords, vocabUsers, vocabSettings,
} from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  // habit-tracker
  await db.delete(checkins);
  await db.delete(habits);
  // vocab-tracker (顺序: 先删子表)
  await db.delete(vocabStatusHistory);
  await db.delete(vocabProgress);
  await db.delete(vocabWords);
  await db.delete(vocabUsers);
  await db.delete(vocabSettings);
  return { success: true };
});
