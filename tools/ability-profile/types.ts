export interface AbilityCategory {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
}

export interface Skill {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  description: string | null;
  icon: string | null;
  source: 'template' | 'ai' | 'custom';
  templateId: string | null;
  currentTier: number;
  status: 'active' | 'paused';
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  totalMilestones: number;
  completedMilestones: number;
}

export interface MilestoneCompletion {
  id: number;
  verifyMethod: string;
  evidenceUrl: string | null;
  evidenceNote: string | null;
  verifiedAt: number;
}

export interface Milestone {
  id: number;
  tier: number;
  title: string;
  description: string | null;
  milestoneType: 'quantity' | 'consistency' | 'achievement' | 'quality';
  verifyMethod: 'platform_auto' | 'platform_test' | 'evidence' | 'self_declare';
  verifyConfig: Record<string, unknown> | null;
  sortOrder: number;
  completion: MilestoneCompletion | null;
}

export interface SkillCurrentState {
  id: number;
  skillId: number;
  stateKey: string;
  stateValue: string;
  stateLabel: string;
  source: 'platform_auto' | 'user_confirmed';
  confirmedAt: number;
  expiresAfterDays: number;
  isExpired?: boolean;
}

export interface SkillDetail extends Omit<Skill, 'totalMilestones' | 'completedMilestones'> {
  milestones: Milestone[];
  currentStates: SkillCurrentState[];
}

export interface RadarPoint {
  categoryId: number;
  categoryName: string;
  icon: string | null;
  score: number;
  skillCount: number;
  sufficient: boolean;
}

export interface SkillTemplate {
  id: string;
  name: string;
  categoryKey: string;
  description: string;
  milestoneCount: number;
  tierCounts: Record<number, number>;
}

export interface SkillTemplateDetail {
  id: string;
  name: string;
  categoryKey: string;
  description: string;
  milestones: Array<{
    tier: number;
    title: string;
    type: string;
    verify: string;
    config: Record<string, unknown>;
  }>;
  defaultStates: Array<{
    key: string;
    label: string;
    source: string;
    expiresAfterDays: number;
  }>;
}

export const TIER_NAMES: Record<number, string> = {
  0: '未开始',
  1: '入门',
  2: '基础',
  3: '胜任',
  4: '精通',
  5: '卓越',
};

export const VERIFY_METHOD_LABELS: Record<string, string> = {
  platform_auto: '平台自动',
  platform_test: '平台验证',
  evidence: '证据提交',
  self_declare: '自评声明',
};

export const MILESTONE_TYPE_LABELS: Record<string, string> = {
  quantity: '数量',
  consistency: '坚持',
  achievement: '成就',
  quality: '质量',
};

export interface FocusPlan {
  id: number;
  skillId: number;
  skillName: string;
  skillCurrentTier: number;
  currentTier: number;
  targetTier: number;
  targetDate: string;
  strategy: string | null;
  status: 'active' | 'achieved' | 'abandoned';
  createdAt: number;
  updatedAt: number;
}

export interface Badge {
  id: number;
  key: string;
  name: string;
  description: string;
  icon: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  awarded: boolean;
  awardedAt: number | null;
}

export const RARITY_LABELS: Record<string, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

export type AbilityView =
  | { type: 'dashboard' }
  | { type: 'skills' }
  | { type: 'skill-detail'; skillId: number }
  | { type: 'add-skill' }
  | { type: 'badges' }
  | { type: 'coach' }
  | { type: 'growth' }
  | { type: 'onboarding' };
