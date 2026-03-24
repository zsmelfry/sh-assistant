import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptCategories, ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '分类');
  const db = useDB(event);

  await requireEntity(db, ptCategories, id, '分类');

  // Check if any projects reference this category
  const projects = await db.select({ id: ptProjects.id })
    .from(ptProjects)
    .where(eq(ptProjects.categoryId, id))
    .limit(1);

  if (projects.length > 0) {
    throw createError({ statusCode: 400, message: '该分类下还有事项，无法删除' });
  }

  await db.delete(ptCategories).where(eq(ptCategories.id, id));
  return { success: true };
});
