/**
 * SM-2 间隔重复算法
 * 移植自 french-words/src/services/srsService.ts
 */

import type { SrsCard } from '../database/schemas/srs';

/** SM-2 质量评分 (0-5) */
export type StudyQuality = 0 | 1 | 2 | 3 | 4 | 5;

/** SM-2 常量 */
export const NEW_WORDS_PER_SESSION = 20;
export const MAX_REVIEWS_PER_SESSION = 100;
export const AUTO_MASTERY_INTERVAL_DAYS = 30;

/** 简化的用户评分按钮映射 */
export const QualityRating = {
  AGAIN: 0 as StudyQuality,   // 完全不记得
  HARD: 2 as StudyQuality,    // 勉强记得
  GOOD: 4 as StudyQuality,    // 记得
  EASY: 5 as StudyQuality,    // 非常容易
} as const;

export interface ReviewResult {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: number;       // timestamp
  lastReviewedAt: number;     // timestamp
}

/**
 * SM-2 核心算法
 * 根据用户自评质量计算下次复习时间
 */
export function calculateNextReview(
  card: Pick<SrsCard, 'easeFactor' | 'interval' | 'repetitions'>,
  quality: StudyQuality,
): ReviewResult {
  let { easeFactor, interval, repetitions } = card;
  const now = Date.now();

  if (quality < 3) {
    // 回答不合格，重置
    repetitions = 0;
    interval = 1;
  } else {
    // 回答合格
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  // 更新难度因子（不低于 1.3）
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  // 计算下次复习日期（设为当天 00:00:00）
  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + interval);
  nextDate.setHours(0, 0, 0, 0);

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewAt: nextDate.getTime(),
    lastReviewedAt: now,
  };
}
