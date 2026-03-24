import { SKILL_TEMPLATES } from '~/server/database/seeds/skill-templates';

export default defineEventHandler((event) => {
  const templateId = getRouterParam(event, 'templateId');
  const template = SKILL_TEMPLATES.find((t) => t.id === templateId);

  if (!template) {
    throw createError({ statusCode: 404, message: `Template '${templateId}' not found` });
  }

  return template;
});
