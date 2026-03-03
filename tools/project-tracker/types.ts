// ===== Enums & Constants =====

export type ProjectStatus = 'idea' | 'todo' | 'in_progress' | 'blocked' | 'done' | 'dropped';
export type Priority = 'low' | 'medium' | 'high';
export type AttachmentType = 'url' | 'image';
export type ChecklistAttachmentType = 'url' | 'image' | 'file';
export type ChatRole = 'user' | 'assistant' | 'system';

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: '灵感',
  todo: '待办',
  in_progress: '进行中',
  blocked: '受阻',
  done: '已完成',
  dropped: '已放弃',
};

export const STATUS_ORDER: Record<ProjectStatus, number> = {
  blocked: 0,
  in_progress: 1,
  todo: 2,
  idea: 3,
  done: 4,
  dropped: 5,
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const ACTIVE_STATUSES: ProjectStatus[] = ['todo', 'in_progress', 'blocked'];
export const ARCHIVE_STATUSES: ProjectStatus[] = ['done', 'dropped'];

// ===== View Routing =====

export type ProjectTrackerView =
  | { type: 'list' }
  | { type: 'detail'; projectId: number };

// ===== Data Types =====

export interface Category {
  id: number;
  name: string;
  sortOrder: number;
  createdAt: number;
}

export interface Tag {
  id: number;
  name: string;
  createdAt: number;
}

export interface Project {
  id: number;
  title: string;
  description: string | null;
  status: ProjectStatus;
  categoryId: number;
  dueDate: string | null;
  priority: Priority;
  blockedReason: string | null;
  reminderAt: number | null;
  archived: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectWithDetails extends Project {
  categoryName: string;
  tags: Tag[];
  checklistTotal: number;
  checklistDone: number;
  noteCount: number;
  diagramCount: number;
}

export interface Milestone {
  id: number;
  projectId: number;
  title: string;
  dueDate: string | null;
  reminderAt: number | null;
  sortOrder: number;
  createdAt: number;
}

export interface ChecklistItem {
  id: number;
  projectId: number;
  content: string;
  description: string | null;
  priority: Priority;
  isCompleted: boolean;
  completedAt: number | null;
  dueDate: string | null;
  reminderAt: number | null;
  milestoneId: number | null;
  linkedNoteId: number | null;
  linkedDiagramId: number | null;
  sortOrder: number;
  createdAt: number;
  attachmentCount?: number;
  linkedNoteTitle?: string | null;
  linkedDiagramTitle?: string | null;
}

export interface ChecklistAttachment {
  id: number;
  checklistItemId: number;
  type: ChecklistAttachmentType;
  url: string | null;
  filePath: string | null;
  originalName: string | null;
  caption: string | null;
  createdAt: number;
}

export interface MilestoneWithItems extends Milestone {
  items: ChecklistItem[];
  total: number;
  done: number;
}

export interface Note {
  id: number;
  projectId: number;
  title: string;
  content: string | null;
  aiSummary: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  id: number;
  noteId: number;
  type: AttachmentType;
  url: string | null;
  filePath: string | null;
  caption: string | null;
  createdAt: number;
}

export interface NoteWithAttachments extends Note {
  attachments: Attachment[];
}

export interface Diagram {
  id: number;
  projectId: number;
  title: string;
  type: string;
  mermaidCode: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: number;
  projectId: number;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export interface ProgressData {
  milestones: { id: number | null; title: string; total: number; done: number }[];
  totalItems: number;
  totalDone: number;
  percentage: number;
}

// ===== Filter Types =====

export interface ProjectFilters {
  statuses: ProjectStatus[];
  categoryId: number | null;
  tagIds: number[];
  search: string;
  showArchived: boolean;
}

// ===== Form Payloads =====

export interface CreateProjectData {
  title: string;
  description?: string;
  status?: ProjectStatus;
  categoryId: number;
  dueDate?: string;
  priority?: Priority;
}

export interface UpdateProjectData {
  title?: string;
  description?: string;
  status?: ProjectStatus;
  categoryId?: number;
  dueDate?: string | null;
  priority?: Priority;
  blockedReason?: string | null;
  reminderAt?: number | null;
}
