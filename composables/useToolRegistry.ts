import type { ToolDefinition } from '~/types';

const tools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.id, tool);
}

export function useToolRegistry() {
  const getAll = (): ToolDefinition[] =>
    Array.from(tools.values()).sort((a, b) => a.order - b.order);

  const get = (id: string): ToolDefinition | undefined => tools.get(id);

  return { getAll, get, register: registerTool };
}
