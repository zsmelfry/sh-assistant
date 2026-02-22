import type { ToolDefinition } from '~/types';

const tools = new Map<string, ToolDefinition>();
// Reactivity trigger — increment to notify computed watchers of Map changes
const version = ref(0);

export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.id, tool);
  version.value++;
}

export function useToolRegistry() {
  const getAll = (): ToolDefinition[] => {
    // Read version to establish Vue reactivity dependency
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    version.value;
    return Array.from(tools.values()).sort((a, b) => a.order - b.order);
  };

  const get = (id: string): ToolDefinition | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    version.value;
    return tools.get(id);
  };

  function unregister(id: string): boolean {
    const deleted = tools.delete(id);
    if (deleted) version.value++;
    return deleted;
  }

  return { getAll, get, register: registerTool, unregister };
}
