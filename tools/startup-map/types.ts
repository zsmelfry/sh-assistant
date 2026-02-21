// ===== 创业地图领域类型 =====

// ===== 学习状态 =====
export type PointStatus = 'not_started' | 'learning' | 'understood' | 'practiced';

export const POINT_STATUS_LABELS: Record<PointStatus, string> = {
  not_started: '未开始',
  learning: '学习中',
  understood: '已理解',
  practiced: '已实践',
};

// ===== 产品阶段 =====
export type ProductStage = 'ideation' | 'researching' | 'preparing' | 'launched';

export const PRODUCT_STAGE_LABELS: Record<ProductStage, string> = {
  ideation: '构想中',
  researching: '调研中',
  preparing: '准备中',
  launched: '已启动',
};

// ===== 视图类型 =====
export type StartupMapView = 'global' | 'domain' | 'point' | 'product';

// ===== 数据库实体类型（与 sm_* 表对齐） =====

export interface SmDomain {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: number;
}

export interface SmTopic {
  id: number;
  domainId: number;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: number;
}

export interface SmPoint {
  id: number;
  topicId: number;
  name: string;
  description: string | null;
  status: PointStatus;
  statusUpdatedAt: number | null;
  sortOrder: number;
  createdAt: number;
}

export interface SmTeaching {
  id: number;
  pointId: number;
  what: string | null;
  how: string | null;
  example: string | null;
  apply: string | null;
  resources: string | null;
  productId: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SmChat {
  id: number;
  pointId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

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

// ===== API 响应类型 =====

/** GET /api/startup-map/domains — domain list with stats */
export interface DomainWithStats extends SmDomain {
  topicCount: number;
  pointCount: number;
  completedCount: number;
  completionRate: number;
}

/** GET /api/startup-map/domains/:id — domain with full tree */
export interface TopicWithPoints extends SmTopic {
  points: SmPoint[];
}

export interface DomainDetail extends SmDomain {
  topics: TopicWithPoints[];
}

/** GET /api/startup-map/points/:id — point with teaching + breadcrumb context */
export interface PointDetail extends SmPoint {
  teaching: SmTeaching | null;
  topic: { id: number; name: string };
  domain: { id: number; name: string };
}

/** Global stats computed from domains */
export interface GlobalStats {
  totalPoints: number;
  completedCount: number;
  completionRate: number;
}

// ===== Teaching sections =====

export type TeachingSection = 'what' | 'how' | 'example' | 'apply' | 'resources';

export const TEACHING_SECTIONS: TeachingSection[] = ['what', 'how', 'example', 'apply', 'resources'];

export const TEACHING_SECTION_LABELS: Record<TeachingSection, string> = {
  what: '是什么',
  how: '怎么做',
  example: '案例',
  apply: '我的应用',
  resources: '推荐资源',
};

// ===== Chat response =====
export interface ChatResponse {
  userMessage: SmChat;
  assistantMessage: SmChat;
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
