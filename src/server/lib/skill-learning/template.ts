/**
 * Simple {{path.to.var}} template engine for skill prompt rendering.
 *
 * Supported variables:
 *   skill.name, skill.description
 *   domain.name, topic.name
 *   point.name, point.description
 *   teachingSummary (chat template only)
 */
export function renderTemplate(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, path: string) => {
    const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], vars);
    return value != null ? String(value) : '';
  });
}
