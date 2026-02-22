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
}

export interface GeneratedStage {
  name: string;
  description: string;
  objective: string;
  pointNames: string[];
}
