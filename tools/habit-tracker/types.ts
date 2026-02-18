import type { HabitFrequency } from '~/types';

export interface CalendarDayData {
  date: string;         // YYYY-MM-DD
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  isCheckedIn: boolean;
  isPeriodCompleted: boolean;
}

export interface FormData {
  name: string;
  frequency: HabitFrequency;
}

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
