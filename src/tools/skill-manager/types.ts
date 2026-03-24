export interface SkillConfig {
  id: number;
  skillId: string;
  name: string;
  description: string | null;
  icon: string;
  teachingSystemPrompt: string;
  teachingUserPrompt: string;
  chatSystemPrompt: string;
  taskSystemPrompt: string;
  taskUserPrompt: string;
  linkedAbilitySkillId: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface GeneratedTree {
  domains: GeneratedDomain[];
  stages: GeneratedStage[];
}

export interface GeneratedDomain {
  name: string;
  description: string;
  topics: GeneratedTopic[];
}

export interface GeneratedTopic {
  name: string;
  description: string;
  points: GeneratedPoint[];
}

export interface GeneratedPoint {
  name: string;
  description: string;
  teaching?: { what: string | null; how: string | null; example: string | null; apply: string | null; resources: string | null } | null;
  note?: string | null;
}

export interface GeneratedStage {
  name: string;
  description: string;
  objective: string;
  pointNames: string[];
}

export interface SkillExportPoint {
  name: string;
  description: string;
  sortOrder: number;
  status: string;
  teaching?: { what: string | null; how: string | null; example: string | null; apply: string | null; resources: string | null } | null;
  note?: string | null;
}

export interface SkillExportTopic {
  name: string;
  description: string;
  sortOrder: number;
  points: SkillExportPoint[];
}

export interface SkillExportDomain {
  name: string;
  description: string;
  sortOrder: number;
  topics: SkillExportTopic[];
}

export interface SkillExport {
  version: 1;
  exportedAt: number;
  config: {
    name: string;
    description: string | null;
    icon: string;
    skillId: string;
    teachingSystemPrompt: string;
    teachingUserPrompt: string;
    chatSystemPrompt: string;
    taskSystemPrompt: string;
    taskUserPrompt: string;
    quizSystemPrompt?: string;
    quizUserPrompt?: string;
    guidanceSystemPrompt?: string;
    guidanceUserPrompt?: string;
    features?: string;
  };
  tree: {
    domains: SkillExportDomain[];
    stages: Array<{ name: string; description: string; objective: string; pointNames: string[] }>;
  };
}
