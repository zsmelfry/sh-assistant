import { eq, and, gte } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smActivities } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';

const VALID_TYPES = ['view', 'chat', 'note', 'task', 'status_change'] as const;

export default defineEventHandler(async (event) => {
  const { skillId } = await resolveSkill(event);
  const body = await readBody(event);

  if (!body.pointId || !body.type) {
    throw createError({ statusCode: 400, message: '缺少 pointId 或 type' });
  }

  const pointId = Number(body.pointId);
  if (!pointId || isNaN(pointId)) {
    throw createError({ statusCode: 400, message: '无效的 pointId' });
  }

  if (!VALID_TYPES.includes(body.type)) {
    throw createError({ statusCode: 400, message: `无效的 type，允许值：${VALID_TYPES.join(', ')}` });
  }

  const db = useDB();
  const now = Date.now();

  // Same-hour dedup: check if same pointId + type + skillId exists within the current hour
  const hourStart = now - (now % 3600000);

  const [existing] = await db.select({ id: smActivities.id })
    .from(smActivities)
    .where(and(
      eq(smActivities.pointId, pointId),
      eq(smActivities.type, body.type),
      eq(smActivities.skillId, skillId),
      gte(smActivities.createdAt, hourStart),
    ))
    .limit(1);

  if (existing) {
    return { deduplicated: true, id: existing.id };
  }

  const date = new Date(now);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const [inserted] = await db.insert(smActivities)
    .values({
      pointId,
      type: body.type,
      skillId,
      date: dateStr,
      createdAt: now,
    })
    .returning();

  return inserted;
});
