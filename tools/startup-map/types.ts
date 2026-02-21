// ===== 创业地图领域类型 =====

// Re-export all shared skill-learning types
export * from '~/composables/skill-learning/types';

// ===== Startup-map specific types =====

import type { SkillLearningView } from '~/composables/skill-learning/types';

// Extends shared view type with product view
export type StartupMapView = SkillLearningView | 'product';

// ===== 产品阶段 =====
export type ProductStage = 'ideation' | 'researching' | 'preparing' | 'launched';

export const PRODUCT_STAGE_LABELS: Record<ProductStage, string> = {
  ideation: '构想中',
  researching: '调研中',
  preparing: '准备中',
  launched: '已启动',
};

// ===== 产品实体 =====
export interface SmProduct {
  id: number;
  name: string;
  description: string | null;
  targetMarket: string | null;
  targetCustomer: string | null;
  productionSource: string | null;
  currentStage: ProductStage;
  notes: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// ===== Product form data =====
export interface ProductFormData {
  name: string;
  description: string;
  targetMarket: string;
  targetCustomer: string;
  productionSource: string;
  currentStage: ProductStage;
  notes: string;
}
