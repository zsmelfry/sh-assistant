import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { abilityCategories, skills, skillCurrentState } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const db = useDB(event);

  const categories = await db.select().from(abilityCategories).orderBy(abilityCategories.sortOrder);
  const allSkills = await db.select().from(skills).where(eq(skills.status, 'active'));
  const allStates = await db.select().from(skillCurrentState);

  // Build a map of skillId -> has expired states
  const statesBySkill = new Map<number, boolean>();
  for (const s of allStates) {
    if (s.expiresAfterDays > 0) {
      const isExpired = Date.now() - s.confirmedAt > s.expiresAfterDays * 24 * 60 * 60 * 1000;
      if (isExpired) {
        statesBySkill.set(s.skillId, true);
      }
    }
  }

  // Group skills by category
  const grouped = new Map<number, typeof allSkills>();
  for (const skill of allSkills) {
    if (!grouped.has(skill.categoryId)) grouped.set(skill.categoryId, []);
    grouped.get(skill.categoryId)!.push(skill);
  }

  return categories.map((cat) => {
    const catSkills = grouped.get(cat.id) || [];
    if (catSkills.length === 0) {
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        icon: cat.icon,
        score: 0,
        skillCount: 0,
        sufficient: false,
      };
    }

    const scores = catSkills.map((skill) => {
      const baseScore = skill.currentTier * 20;
      const hasExpired = statesBySkill.get(skill.id) || false;
      return hasExpired ? Math.round(baseScore * 0.7) : baseScore;
    });

    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      icon: cat.icon,
      score: avgScore,
      skillCount: catSkills.length,
      sufficient: catSkills.length >= 2,
    };
  });
});
