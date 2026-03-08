import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skills, milestones, skillCurrentState, abilityCategories } from '~/server/database/schema';
import { SKILL_TEMPLATES } from '~/server/database/seeds/skill-templates';
import { requireNonEmpty } from '~/server/utils/handler-helpers';
import { logActivity } from '~/server/lib/ability/log-activity';
import { checkBadgesOnSkillChange } from '~/server/lib/ability/badge-check';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const name = requireNonEmpty(body.name, '技能名称');

  const db = useDB();

  // Validate categoryId
  const categoryId = Number(body.categoryId);
  if (!categoryId) {
    throw createError({ statusCode: 400, message: '请选择能力大类' });
  }
  const [category] = await db.select().from(abilityCategories).where(eq(abilityCategories.id, categoryId));
  if (!category) {
    throw createError({ statusCode: 404, message: '能力大类不存在' });
  }

  const source = body.source || 'custom';
  if (!['template', 'ai', 'custom', 'system'].includes(source)) {
    throw createError({ statusCode: 400, message: '无效的来源类型' });
  }

  const now = Date.now();

  // Get next sortOrder
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${skills.sortOrder}), -1)` })
    .from(skills);

  // Insert skill
  const [inserted] = await db.insert(skills).values({
    categoryId,
    name,
    description: body.description || null,
    icon: body.icon || null,
    source,
    templateId: body.templateId || null,
    currentTier: 0,
    status: 'active',
    sortOrder: maxRow.max + 1,
    createdAt: now,
    updatedAt: now,
  }).returning();

  // If creating from template, auto-generate milestones and default states
  if (source === 'template' && body.templateId) {
    const template = SKILL_TEMPLATES.find((t) => t.id === body.templateId);
    if (template) {
      // Insert milestones
      if (template.milestones.length > 0) {
        await db.insert(milestones).values(
          template.milestones.map((m, idx) => ({
            skillId: inserted.id,
            tier: m.tier,
            title: m.title,
            description: m.description || null,
            milestoneType: m.type,
            verifyMethod: m.verify,
            verifyConfig: JSON.stringify(m.config),
            sortOrder: idx,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }

      // Insert default states
      if (template.defaultStates.length > 0) {
        await db.insert(skillCurrentState).values(
          template.defaultStates.map((s) => ({
            skillId: inserted.id,
            stateKey: s.key,
            stateValue: '',
            stateLabel: s.label,
            source: s.source,
            confirmedAt: now,
            expiresAfterDays: s.expiresAfterDays,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
    }
  }

  // Log activity
  await logActivity({
    skillId: inserted.id,
    categoryId,
    source: 'manual',
    description: `添加技能：${name}`,
  });

  // Check if new skill triggers badge awards
  checkBadgesOnSkillChange(db, 'create').catch(() => {});

  setResponseStatus(event, 201);
  return inserted;
});
