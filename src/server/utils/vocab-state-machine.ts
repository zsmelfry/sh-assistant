/**
 * 词汇学习状态机 - 管理学习状态转换逻辑
 * 移植自 french-words/src/services/stateMachine.ts
 */

import { LEARNING_STATUS, type LearningStatus } from '../database/schemas/vocab';

export type StatusAction = 'SET_TO_LEARN' | 'SET_LEARNING' | 'SET_MASTERED';

const VALID_STATUSES = new Set(Object.values(LEARNING_STATUS));

export function isValidStatus(status: string): status is LearningStatus {
  return VALID_STATUSES.has(status as LearningStatus);
}

export function isValidAction(action: string): action is StatusAction {
  return action === 'SET_TO_LEARN' || action === 'SET_LEARNING' || action === 'SET_MASTERED';
}

/**
 * 状态转换函数（纯函数）
 */
export function transitionStatus(current: LearningStatus, action: StatusAction): LearningStatus {
  switch (action) {
    case 'SET_TO_LEARN':
      return current === LEARNING_STATUS.UNREAD ? LEARNING_STATUS.TO_LEARN : current;

    case 'SET_LEARNING':
      if (current === LEARNING_STATUS.UNREAD ||
          current === LEARNING_STATUS.TO_LEARN ||
          current === LEARNING_STATUS.MASTERED) {
        return LEARNING_STATUS.LEARNING;
      }
      return current;

    case 'SET_MASTERED':
      if (current === LEARNING_STATUS.UNREAD ||
          current === LEARNING_STATUS.TO_LEARN ||
          current === LEARNING_STATUS.LEARNING) {
        return LEARNING_STATUS.MASTERED;
      }
      return current;

    default:
      return current;
  }
}

/**
 * 从学习状态派生布尔标志
 */
export function deriveFlags(status: LearningStatus) {
  return {
    isRead: status === LEARNING_STATUS.LEARNING || status === LEARNING_STATUS.MASTERED,
    isMastered: status === LEARNING_STATUS.MASTERED,
  };
}

/**
 * 检查是否是首次开始学习
 */
export function isFirstInteraction(previous: LearningStatus, next: LearningStatus): boolean {
  const wasNotStarted = previous === LEARNING_STATUS.UNREAD || previous === LEARNING_STATUS.TO_LEARN;
  const isNowStarted = next === LEARNING_STATUS.LEARNING || next === LEARNING_STATUS.MASTERED;
  return wasNotStarted && isNowStarted;
}
