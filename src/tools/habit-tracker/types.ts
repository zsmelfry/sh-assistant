// ===== 习惯打卡领域类型 =====

export type HabitFrequency = 'daily' | 'weekly' | 'monthly';

export type YearMonth = string; // "YYYY-MM"

export interface Habit {
  id: string;
  name: string;
  frequency: HabitFrequency;
  linkedAbilitySkillId: number | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CheckIn {
  id: string;
  habitId: string;
  date: string;
  note?: string | null;
  createdAt: number;
}

// ===== API 响应类型 =====

export interface StatsResponse {
  streak: number;
  monthlyRate: number;
  allDates: string[];
}

export interface HeatmapResponse {
  dates: string[];
}

export interface TrendMonth {
  month: string;
  total: number;
  completed: number;
  rate: number;
}

export interface TrendResponse {
  months: TrendMonth[];
}

// ===== UI 类型 =====

export interface CalendarDayData {
  date: string;         // YYYY-MM-DD
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  isCheckedIn: boolean;
  isPeriodCompleted: boolean;
  note?: string | null;
}

export interface FormData {
  name: string;
  frequency: HabitFrequency;
}

// ===== 常量映射 =====

export const FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
};

export const FREQUENCY_BADGES: Record<HabitFrequency, string> = {
  daily: '日',
  weekly: '周',
  monthly: '月',
};

export const STREAK_LABELS: Record<HabitFrequency, string> = {
  daily: '连续打卡天数',
  weekly: '连续完成周数',
  monthly: '连续完成月数',
};

export const RATE_LABELS: Record<HabitFrequency, string> = {
  daily: '本月完成率',
  weekly: '本月周完成率',
  monthly: '本月完成状态',
};
