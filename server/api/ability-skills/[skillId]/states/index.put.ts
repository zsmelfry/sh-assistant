import { eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skillCurrentState, skills } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';
import { logActivity } from '~/server/lib/ability/log-activity';

export default defineEventHandler(async (event) => {
  const skillId = requireNumericParam(event, 'skillId', '技能');
  const body = await readBody(event);
  const db = useDB();

  await requireEntity(db, skills, skillId, '技能');

  if (!Array.isArray(body.states)) {
    throw createError({ statusCode: 400, message: 'states 必须是数组' });
  }

  const now = Date.now();
  const results = [];

  for (const s of body.states) {
    if (!s.stateKey || !s.stateLabel) continue;

    // Upsert: try update first, insert if not found
    const [existing] = await db.select().from(skillCurrentState)
      .where(and(
        eq(skillCurrentState.skillId, skillId),
        eq(skillCurrentState.stateKey, s.stateKey),
      ));

    if (existing) {
      const [updated] = await db.update(skillCurrentState).set({
        stateValue: String(s.stateValue ?? ''),
        stateLabel: s.stateLabel,
        source: s.source || existing.source,
        confirmedAt: now,
        updatedAt: now,
      }).where(eq(skillCurrentState.id, existing.id)).returning();
      results.push(updated);
    } else {
      const [inserted] = await db.insert(skillCurrentState).values({
        skillId,
        stateKey: s.stateKey,
        stateValue: String(s.stateValue ?? ''),
        stateLabel: s.stateLabel,
        source: s.source || 'user_confirmed',
        confirmedAt: now,
        expiresAfterDays: s.expiresAfterDays ?? 180,
        createdAt: now,
        updatedAt: now,
      }).returning();
      results.push(inserted);
    }
  }

  // Log activity if states were updated
  if (results.length > 0) {
    const [skill] = await db.select().from(skills).where(eq(skills.id, skillId));
    await logActivity({
      skillId,
      categoryId: skill?.categoryId ?? null,
      source: 'manual',
      description: `更新状态：${results.map((r) => r.stateLabel).join('、')}`,
    });
  }

  return results;
});
