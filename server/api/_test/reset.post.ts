import { useDB } from '~/server/database';
import {
  users,
  habits, checkins,
  vocabStatusHistory, vocabProgress, vocabWords, vocabUsers, vocabSettings,
  reviewLogs, srsCards, definitions, studySessions,
  llmProviders,
  plannerGoalTags, plannerCheckitems, plannerGoals, plannerDomains, plannerTags,
  articleChats, articleTagMap, articleTags, articleTranslations, articleBookmarks, articles,
  smChats, smTeachings, smPoints, smTopics, smDomains, smProducts,
  smActivities, smPointArticles, smNotes, smTasks, smStagePoints, smStages,
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
  // article-reader (child tables first, including cross-module FK)
  await db.delete(smPointArticles);
  await db.delete(articleChats);
  await db.delete(articleTagMap);
  await db.delete(articleTags);
  await db.delete(articleTranslations);
  await db.delete(articleBookmarks);
  await db.delete(articles);
  // planner (child tables first)
  await db.delete(plannerGoalTags);
  await db.delete(plannerCheckitems);
  await db.delete(plannerGoals);
  await db.delete(plannerDomains);
  await db.delete(plannerTags);
  // startup-map (child tables first)
  await db.delete(smActivities);
  await db.delete(smNotes);
  await db.delete(smTasks);
  await db.delete(smStagePoints);
  await db.delete(smStages);
  await db.delete(smChats);
  await db.delete(smTeachings);
  await db.delete(smPoints);
  await db.delete(smTopics);
  await db.delete(smDomains);
  await db.delete(smProducts);
  return { success: true };
});
