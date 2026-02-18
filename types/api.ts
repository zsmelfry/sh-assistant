export interface ApiError {
  error: string;
}

export interface ToggleResponse {
  checked: boolean;
  checkin?: {
    id: string;
    habitId: string;
    date: string;
    createdAt: number;
  };
}

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
