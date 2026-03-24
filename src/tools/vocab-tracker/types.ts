// ===== 法语词汇领域类型 =====

export interface User {
  id: number;
  nickname: string;
  createdAt: number;
}

export interface Word {
  id: number;
  rank: number;
  word: string;
}

export type LearningStatus = 'unread' | 'to_learn' | 'learning' | 'mastered';

export interface Progress {
  id: number;
  learningStatus: LearningStatus;
  isRead: boolean;
  isMastered: boolean;
  firstInteractedAt: number | null;
  masteredAt: number | null;
  note?: string | null;
}

export interface WordWithProgress extends Word {
  progress: Progress | null;
}

export type FilterType = 'all' | 'unread' | 'toLearn' | 'learning' | 'mastered';

export type StatusAction = 'SET_TO_LEARN' | 'SET_LEARNING' | 'SET_MASTERED';

export interface Stats {
  total: number;
  unread: number;
  toLearn: number;
  learning: number;
  mastered: number;
}

export interface ChartDataPoint {
  date: string; // YYYY-MM-DD
  masteredCount: number;
  readCount: number;
}

// ===== API 响应类型 =====

export interface UsersResponse {
  users: User[];
  lastUserId: number | null;
}

export interface WordListResponse {
  words: WordWithProgress[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ChartRawResponse {
  dailyActivity: Array<{ date: string; new_status: string; count: number }>;
  masteredCurve: Array<{ date: string; count: number }>;
  interactedCurve: Array<{ date: string; count: number }>;
  days: number;
}

export interface ImportResponse {
  imported: number;
}

// ===== UI 常量 =====

export const FILTER_LABELS: Record<FilterType, string> = {
  all: '全部',
  unread: '未读',
  toLearn: '待学习',
  learning: '正在学习',
  mastered: '已掌握',
};

export const STATUS_LABELS: Record<LearningStatus, string> = {
  unread: '未读',
  to_learn: '待学习',
  learning: '正在学习',
  mastered: '已掌握',
};
