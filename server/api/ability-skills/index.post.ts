import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skills, milestones, skillCurrentState, abilityCategories, VALID_MILESTONE_TYPES, VALID_VERIFY_METHODS } from '~/server/database/schema';
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

  // Insert milestones: use custom milestones from body if provided, otherwise auto-generate from template
  const customMilestones = body.milestones as Array<{
    tier: number; title: string; description?: string;
    type: string; verify: string; config?: Record<string, unknown>;
  }> | undefined;

  if (customMilestones && customMilestones.length > 0) {
    // User-provided milestones (from preview/edit flow)
    const toInsert = customMilestones
      .filter((m) => m.tier >= 1 && m.tier <= 5 && m.title && (VALID_MILESTONE_TYPES as readonly string[]).includes(m.type) && (VALID_VERIFY_METHODS as readonly string[]).includes(m.verify))
      .map((m, idx) => ({
        skillId: inserted.id,
        tier: m.tier,
        title: m.title,
        description: m.description || null,
        milestoneType: m.type,
        verifyMethod: m.verify,
        verifyConfig: m.config ? JSON.stringify(m.config) : null,
        sortOrder: idx,
        createdAt: now,
        updatedAt: now,
      }));

    if (toInsert.length > 0) {
      await db.insert(milestones).values(toInsert);
    }
  } else if (source === 'template' && body.templateId) {
    // Auto-generate from template (legacy flow)
    const template = SKILL_TEMPLATES.find((t) => t.id === body.templateId);
    if (template && template.milestones.length > 0) {
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
  }

  // Insert default states from template if applicable
  if (source === 'template' && body.templateId) {
    const template = SKILL_TEMPLATES.find((t) => t.id === body.templateId);
    if (template && template.defaultStates.length > 0) {
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
