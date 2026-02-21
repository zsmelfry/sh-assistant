import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smTasks } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '任务');

  const body = await readBody(event);
  if (body.isCompleted === undefined) {
    throw createError({ statusCode: 400, message: '缺少 isCompleted 字段' });
  }

  const db = useDB();

  // Verify task exists
  const [task] = await db.select()
    .from(smTasks)
    .where(eq(smTasks.id, id))
    .limit(1);

  if (!task) {
    throw createError({ statusCode: 404, message: '任务不存在' });
  }

  const now = Date.now();
  const [updated] = await db.update(smTasks)
    .set({
      isCompleted: body.isCompleted,
      completionNote: body.completionNote ?? task.completionNote,
      completedAt: body.isCompleted ? now : null,
      updatedAt: now,
    })
    .where(eq(smTasks.id, id))
    .returning();

  return updated;
});
