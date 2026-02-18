import type { Component } from 'vue';

export interface ToolDefinition {
  id: string;
  name: string;
  icon: string;
  order: number;
  component: () => Promise<Component>;
  namespaces: string[];
}

export type HabitFrequency = 'daily' | 'weekly' | 'monthly';

export type YearMonth = string; // "YYYY-MM"

export interface Habit {
  id: string;
  name: string;
  frequency: HabitFrequency;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CheckIn {
  id: string;
  habitId: string;
  date: string;
  createdAt: number;
}
