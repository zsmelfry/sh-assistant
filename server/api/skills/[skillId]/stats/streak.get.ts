import { eq, desc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smActivities } from '~/server/database/schema';
import { resolveSkill } from '~/server/lib/skill-learning';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { skillId } = await resolveSkill(db, event);

  const rows = await db
    .selectDistinct({ date: smActivities.date })
    .from(smActivities)
    .where(eq(smActivities.skillId, skillId))
    .orderBy(desc(smActivities.date));

  if (rows.length === 0) {
    return { streak: 0 };
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const dateSet = new Set(rows.map(r => r.date));

  let streak = 0;
  let checkDate = new Date(today);

  if (!dateSet.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (dateSet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return { streak };
});
