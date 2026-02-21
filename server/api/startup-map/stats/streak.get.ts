import { sql, desc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smActivities } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();

  // Get all distinct dates with activity, ordered desc
  const rows = await db
    .selectDistinct({ date: smActivities.date })
    .from(smActivities)
    .orderBy(desc(smActivities.date));

  if (rows.length === 0) {
    return { streak: 0 };
  }

  // Calculate streak from today backwards
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const dateSet = new Set(rows.map(r => r.date));

  // Streak counts from today or yesterday
  let streak = 0;
  let checkDate = new Date(today);

  // If today has no activity, start from yesterday
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
