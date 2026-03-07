import { SKILL_TEMPLATES } from '~/server/database/seeds/skill-templates';

export default defineEventHandler(() => {
  return SKILL_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    categoryKey: t.categoryKey,
    description: t.description,
    milestoneCount: t.milestones.length,
    tierCounts: Object.fromEntries(
      [1, 2, 3, 4, 5].map((tier) => [
        tier,
        t.milestones.filter((m) => m.tier === tier).length,
      ]),
    ),
  }));
});
