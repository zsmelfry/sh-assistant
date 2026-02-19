import { useDB } from '~/server/database';
import {
  users,
  habits, checkins,
  vocabStatusHistory, vocabProgress, vocabWords, vocabUsers, vocabSettings,
  reviewLogs, srsCards, definitions, studySessions,
  llmProviders,
  plannerGoalTags, plannerCheckitems, plannerGoals, plannerDomains, plannerTags,
} from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  // auth
  await db.delete(users);
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
  // planner (child tables first)
  await db.delete(plannerGoalTags);
  await db.delete(plannerCheckitems);
  await db.delete(plannerGoals);
  await db.delete(plannerDomains);
  await db.delete(plannerTags);
  return { success: true };
});
