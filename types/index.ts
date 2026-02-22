import type { Component } from 'vue';

export interface ToolDefinition {
  id: string;
  name: string;
  icon: Component;
  order: number;
  component: () => Promise<Component>;
  namespaces: string[];
  props?: Record<string, any>;
}
