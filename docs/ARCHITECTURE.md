# 技术架构文档 - 可扩展日常助手工具

> 版本: v1.0
> 日期: 2026-02-17
> 作者: 小M (架构师)
> 状态: 初稿

---

## 1. 技术栈选择

| 类别 | 选型 | 理由 |
|------|------|------|
| 前端框架 | **React 19 + TypeScript** | 组件模型天然适配插件化架构；`React.lazy` + `Suspense` 原生支持工具懒加载；生态最大，长期维护有保障 |
| 状态管理 | **Zustand** | 极轻量（< 1KB）；无 Provider 嵌套，工具插件可独立创建 store 而不污染全局；原生支持 TypeScript 和 subscribe |
| 数据存储 | **Dexie.js (IndexedDB)** | 提供类 ORM 的 API（`where`/`filter`/`orderBy`），比原生 IndexedDB 开发体验好一个数量级；支持事务、索引、版本迁移；容量远大于 localStorage（数百 MB） |
| 构建工具 | **Vite 6** | 冷启动 < 300ms；原生 ESM + 按需编译；`import()` 动态导入零配置；内置 TypeScript 支持 |
| 路由 | **React Router v7** | SPA 标准方案；支持 lazy routes，与工具懒加载天然契合 |
| 样式方案 | **CSS Modules + CSS Custom Properties** | CSS Modules 提供作用域隔离，工具间样式互不干扰；CSS 变量定义全局色板，集中管理黑白色调主题 |
| UUID 生成 | **crypto.randomUUID()** | 浏览器原生 API，无需额外依赖 |
| 日期处理 | **date-fns** | Tree-shakable，按需引入；不引入 moment/dayjs 的全量包体积 |

### 不选什么，为什么

| 不选 | 理由 |
|------|------|
| Vue | React 的 lazy/Suspense 对插件懒加载支持更成熟；团队更熟悉 React |
| Redux / MobX | 对 MVP 过重，Zustand 足够且更简洁 |
| Tailwind CSS | 黑白设计系统颜色固定，不需要 utility-first 的灵活性；CSS Modules 更轻、工具隔离更彻底 |
| localStorage | 5MB 容量限制，无索引查询能力，不适合结构化数据 |
| 原生 IndexedDB | API 过于底层，回调地狱，开发效率低 |

---

## 2. 项目目录结构

```
personal-assistant/
├── index.html                    # 入口 HTML
├── package.json
├── tsconfig.json
├── vite.config.ts
├── docs/
│   ├── PRD.md
│   └── ARCHITECTURE.md
│
└── src/
    ├── main.tsx                   # 应用入口，挂载 React
    ├── App.tsx                    # 根组件：布局 + 路由
    ├── vite-env.d.ts
    │
    ├── platform/                  # 平台层 —— 工具无需修改此目录
    │   ├── registry/
    │   │   ├── tool-registry.ts   # 工具注册表（核心）
    │   │   └── types.ts           # ToolDefinition 接口定义
    │   ├── layout/
    │   │   ├── AppLayout.tsx      # 整体布局组件（侧边栏 + 主内容区）
    │   │   ├── Sidebar.tsx        # 侧边栏组件
    │   │   └── AppLayout.module.css
    │   ├── data/
    │   │   ├── types.ts           # DataStore 抽象接口
    │   │   ├── dexie-store.ts     # Dexie IndexedDB 实现
    │   │   ├── data-context.tsx   # React Context 提供数据层
    │   │   └── use-store.ts       # useStore hook
    │   └── theme/
    │       └── variables.css      # 全局 CSS 变量（色板、圆角、动画）
    │
    ├── tools/                     # 工具目录 —— 每个工具一个子目录
    │   └── habit-tracker/         # 日历打卡工具
    │       ├── index.ts           # 工具定义（ToolDefinition 导出）
    │       ├── HabitTracker.tsx    # 工具根组件
    │       ├── components/
    │       │   ├── HabitList.tsx       # 习惯列表（侧边面板）
    │       │   ├── HabitForm.tsx       # 创建/编辑习惯表单
    │       │   ├── Calendar.tsx        # 月历视图
    │       │   ├── CalendarDay.tsx     # 单日格子
    │       │   ├── CalendarNav.tsx     # 月份切换导航
    │       │   ├── StatsBar.tsx        # 统计栏（连续天数、完成率）
    │       │   └── EmptyState.tsx      # 首次使用空状态
    │       ├── store/
    │       │   └── habit-store.ts      # Zustand store（习惯 + 打卡状态）
    │       ├── services/
    │       │   └── habit-service.ts    # 数据操作封装（调用 DataStore）
    │       ├── types.ts                # Habit、CheckIn 类型定义
    │       └── styles/
    │           ├── HabitTracker.module.css
    │           ├── Calendar.module.css
    │           └── HabitList.module.css
    │
    ├── shared/                    # 共享 UI 组件（可选，按需抽取）
    │   ├── Button.tsx
    │   ├── Modal.tsx
    │   ├── ConfirmDialog.tsx
    │   └── shared.module.css
    │
    └── types/                     # 全局类型
        └── global.d.ts
```

### 目录职责说明

| 目录 | 职责 | 谁关心 |
|------|------|--------|
| `src/platform/` | 平台核心：工具注册、数据层抽象、布局。**添加新工具不需要修改此目录** | 架构师 |
| `src/tools/` | 工具实现。每个子目录是独立工具，自包含组件/状态/服务 | 工具开发者 |
| `src/shared/` | 跨工具复用的 UI 原子组件 | 所有人 |
| `src/platform/data/` | 数据存储抽象层 + IndexedDB 实现 | 数据层开发 |

---

## 3. 可扩展工具架构

### 3.1 核心接口：ToolDefinition

```typescript
// src/platform/registry/types.ts

import { ComponentType, LazyExoticComponent } from 'react';

/**
 * 每个工具必须导出一个符合此接口的对象
 */
export interface ToolDefinition {
  /** 唯一标识，如 'habit-tracker' */
  id: string;

  /** 显示名称，如 '日历打卡' */
  name: string;

  /** 图标标识（使用 emoji 或 icon name） */
  icon: string;

  /** 在侧边栏中的排列顺序，数字越小越靠前 */
  order: number;

  /**
   * 工具的根组件（懒加载）
   * 使用 React.lazy(() => import('./MyTool')) 包裹
   */
  component: LazyExoticComponent<ComponentType>;

  /** 工具使用的数据命名空间列表，用于数据层权限/隔离 */
  namespaces: string[];
}
```

### 3.2 工具注册表

```typescript
// src/platform/registry/tool-registry.ts

import { ToolDefinition } from './types';

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /** 注册一个工具 */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.id)) {
      console.warn(`Tool "${tool.id}" is already registered. Skipping.`);
      return;
    }
    this.tools.set(tool.id, tool);
  }

  /** 获取单个工具定义 */
  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  /** 获取所有工具，按 order 排序 */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values()).sort((a, b) => a.order - b.order);
  }

  /** 获取所有工具 ID */
  getIds(): string[] {
    return this.getAll().map((t) => t.id);
  }
}

// 单例导出
export const toolRegistry = new ToolRegistry();
```

### 3.3 工具注册方式

每个工具在自己的 `index.ts` 中定义并注册：

```typescript
// src/tools/habit-tracker/index.ts

import { lazy } from 'react';
import { ToolDefinition } from '../../platform/registry/types';
import { toolRegistry } from '../../platform/registry/tool-registry';

const definition: ToolDefinition = {
  id: 'habit-tracker',
  name: '日历打卡',
  icon: '📅',
  order: 1,
  component: lazy(() => import('./HabitTracker')),
  namespaces: ['habits', 'checkins'],
};

toolRegistry.register(definition);

export default definition;
```

### 3.4 工具加载入口

在应用启动时，统一导入所有工具注册文件：

```typescript
// src/tools/index.ts  —— 工具汇总入口
// 新增工具时，只需在此文件添加一行 import

import './habit-tracker';
// import './todo-list';       // 未来的待办工具
// import './pomodoro';        // 未来的番茄钟工具
```

```typescript
// src/main.tsx
import './tools';  // 执行所有工具注册
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

### 3.5 新工具接入流程（3 步完成）

1. **创建工具目录**: `src/tools/my-new-tool/`，包含组件、store、service
2. **导出 ToolDefinition**: 在 `index.ts` 中定义并调用 `toolRegistry.register()`
3. **注册入口**: 在 `src/tools/index.ts` 中添加 `import './my-new-tool'`

**无需修改** `platform/` 下的任何文件。

### 3.6 懒加载机制

工具组件通过 `React.lazy` + `Suspense` 实现懒加载：

```tsx
// src/App.tsx 中渲染工具的部分

import { Suspense } from 'react';
import { toolRegistry } from './platform/registry/tool-registry';

function ToolView({ toolId }: { toolId: string }) {
  const tool = toolRegistry.get(toolId);
  if (!tool) return <div>工具不存在</div>;

  const ToolComponent = tool.component;
  return (
    <Suspense fallback={<div className="loading">加载中...</div>}>
      <ToolComponent />
    </Suspense>
  );
}
```

Vite 会自动将每个 `lazy(() => import(...))` 拆分为独立 chunk，只在用户切换到该工具时才加载。

---

## 4. 共享数据层设计

### 4.1 数据存储抽象接口

```typescript
// src/platform/data/types.ts

/** 所有存储实体的基础字段 */
export interface BaseEntity {
  id: string;
  createdAt: number;  // Unix timestamp (ms)
  updatedAt: number;
}

/** 查询过滤条件 */
export interface QueryFilter<T> {
  where?: Partial<T>;
  orderBy?: keyof T;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/** 数据变更事件 */
export interface DataChangeEvent<T = unknown> {
  namespace: string;
  type: 'create' | 'update' | 'delete';
  id: string;
  data?: T;
}

export type DataChangeListener = (event: DataChangeEvent) => void;

/**
 * 数据存储抽象接口
 * MVP 阶段使用 IndexedDB 实现，未来可替换为远程 API
 */
export interface DataStore {
  /**
   * 创建一条记录
   * @param namespace 数据命名空间，如 'habits'
   * @param data 记录数据（不含 id、createdAt、updatedAt，自动生成）
   * @returns 完整的记录（含生成的字段）
   */
  create<T extends BaseEntity>(
    namespace: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<T>;

  /**
   * 根据 ID 获取单条记录
   */
  getById<T extends BaseEntity>(
    namespace: string,
    id: string
  ): Promise<T | undefined>;

  /**
   * 查询记录列表
   */
  query<T extends BaseEntity>(
    namespace: string,
    filter?: QueryFilter<T>
  ): Promise<T[]>;

  /**
   * 更新一条记录（部分更新）
   */
  update<T extends BaseEntity>(
    namespace: string,
    id: string,
    data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<T>;

  /**
   * 删除一条记录
   */
  delete(namespace: string, id: string): Promise<void>;

  /**
   * 按条件批量删除
   */
  deleteWhere<T extends BaseEntity>(
    namespace: string,
    where: Partial<T>
  ): Promise<number>;

  /**
   * 订阅数据变更
   * @returns 取消订阅的函数
   */
  subscribe(
    namespace: string,
    listener: DataChangeListener
  ): () => void;
}
```

### 4.2 IndexedDB 实现（Dexie）

```typescript
// src/platform/data/dexie-store.ts

import Dexie, { Table } from 'dexie';
import {
  DataStore,
  BaseEntity,
  QueryFilter,
  DataChangeEvent,
  DataChangeListener,
} from './types';

/** 通用记录类型（IndexedDB 中的存储格式） */
interface StoredRecord extends BaseEntity {
  _namespace: string;   // 命名空间标识，用于数据隔离
  [key: string]: unknown;
}

class AssistantDB extends Dexie {
  records!: Table<StoredRecord>;

  constructor() {
    super('personal-assistant');

    this.version(1).stores({
      // _namespace + id 为复合主键区域
      // 索引: _namespace（用于命名空间查询），_namespace+id（唯一查询）
      records: 'id, _namespace, [_namespace+id], createdAt, updatedAt',
    });
  }
}

export class DexieDataStore implements DataStore {
  private db: AssistantDB;
  private listeners: Map<string, Set<DataChangeListener>> = new Map();

  constructor() {
    this.db = new AssistantDB();
  }

  async create<T extends BaseEntity>(
    namespace: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<T> {
    const now = Date.now();
    const record: StoredRecord = {
      ...data,
      id: crypto.randomUUID(),
      _namespace: namespace,
      createdAt: now,
      updatedAt: now,
    } as StoredRecord;

    await this.db.records.add(record);

    const result = this.stripNamespace(record) as T;
    this.emit(namespace, { namespace, type: 'create', id: result.id, data: result });
    return result;
  }

  async getById<T extends BaseEntity>(
    namespace: string,
    id: string
  ): Promise<T | undefined> {
    const record = await this.db.records
      .where({ _namespace: namespace, id })
      .first();
    return record ? (this.stripNamespace(record) as T) : undefined;
  }

  async query<T extends BaseEntity>(
    namespace: string,
    filter?: QueryFilter<T>
  ): Promise<T[]> {
    let collection = this.db.records.where('_namespace').equals(namespace);

    let results = await collection.toArray();

    // 应用 where 过滤
    if (filter?.where) {
      const conditions = filter.where;
      results = results.filter((record) =>
        Object.entries(conditions).every(
          ([key, value]) => record[key] === value
        )
      );
    }

    // 排序
    if (filter?.orderBy) {
      const key = filter.orderBy as string;
      const dir = filter.order === 'desc' ? -1 : 1;
      results.sort((a, b) => {
        if (a[key] < b[key]) return -1 * dir;
        if (a[key] > b[key]) return 1 * dir;
        return 0;
      });
    }

    // 分页
    if (filter?.offset) {
      results = results.slice(filter.offset);
    }
    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }

    return results.map((r) => this.stripNamespace(r) as T);
  }

  async update<T extends BaseEntity>(
    namespace: string,
    id: string,
    data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<T> {
    await this.db.records
      .where({ _namespace: namespace, id })
      .modify({ ...data, updatedAt: Date.now() });

    const updated = await this.getById<T>(namespace, id);
    if (!updated) throw new Error(`Record ${namespace}/${id} not found`);

    this.emit(namespace, { namespace, type: 'update', id, data: updated });
    return updated;
  }

  async delete(namespace: string, id: string): Promise<void> {
    await this.db.records.where({ _namespace: namespace, id }).delete();
    this.emit(namespace, { namespace, type: 'delete', id });
  }

  async deleteWhere<T extends BaseEntity>(
    namespace: string,
    where: Partial<T>
  ): Promise<number> {
    const records = await this.query<T>(namespace, { where });
    const ids = records.map((r) => r.id);

    await this.db.records
      .where('_namespace')
      .equals(namespace)
      .filter((r) => ids.includes(r.id))
      .delete();

    for (const id of ids) {
      this.emit(namespace, { namespace, type: 'delete', id });
    }

    return ids.length;
  }

  subscribe(namespace: string, listener: DataChangeListener): () => void {
    if (!this.listeners.has(namespace)) {
      this.listeners.set(namespace, new Set());
    }
    this.listeners.get(namespace)!.add(listener);

    return () => {
      this.listeners.get(namespace)?.delete(listener);
    };
  }

  private emit(namespace: string, event: DataChangeEvent): void {
    this.listeners.get(namespace)?.forEach((fn) => fn(event));
    // 通配符监听（跨工具场景）
    this.listeners.get('*')?.forEach((fn) => fn(event));
  }

  private stripNamespace(record: StoredRecord): Omit<StoredRecord, '_namespace'> {
    const { _namespace, ...rest } = record;
    return rest;
  }
}
```

### 4.3 React 集成

```typescript
// src/platform/data/data-context.tsx

import { createContext, useContext, ReactNode } from 'react';
import { DataStore } from './types';
import { DexieDataStore } from './dexie-store';

const DataStoreContext = createContext<DataStore | null>(null);

// 单例实例
const store = new DexieDataStore();

export function DataStoreProvider({ children }: { children: ReactNode }) {
  return (
    <DataStoreContext.Provider value={store}>
      {children}
    </DataStoreContext.Provider>
  );
}

export function useDataStore(): DataStore {
  const store = useContext(DataStoreContext);
  if (!store) {
    throw new Error('useDataStore must be used within DataStoreProvider');
  }
  return store;
}
```

### 4.4 命名空间隔离规则

| 工具 | 命名空间 | 存储内容 |
|------|---------|---------|
| 日历打卡 | `habits` | 习惯实体 |
| 日历打卡 | `checkins` | 打卡记录 |
| （未来）待办 | `todos` | 待办事项 |
| （未来）番茄钟 | `pomodoros` | 番茄钟记录 |

命名空间通过 `_namespace` 字段在 IndexedDB 中隔离，各工具只能通过自己声明的 `namespaces` 访问对应数据。

### 4.5 存储实现可替换性

未来切换到远程 API 时，只需：
1. 新建 `api-store.ts` 实现 `DataStore` 接口
2. 在 `data-context.tsx` 中将 `new DexieDataStore()` 替换为 `new ApiDataStore()`

上层工具代码零修改。

---

## 5. 日历打卡工具实现架构

### 5.1 类型定义

```typescript
// src/tools/habit-tracker/types.ts

import { BaseEntity } from '../../platform/data/types';

export interface Habit extends BaseEntity {
  name: string;
  archived: boolean;
}

export interface CheckIn extends BaseEntity {
  habitId: string;
  date: string;  // 'YYYY-MM-DD' 格式
}

/** 月份标识 */
export type YearMonth = `${number}-${string}`;  // e.g. '2026-02'

/** 日历中单日的渲染数据 */
export interface CalendarDayData {
  date: string;         // 'YYYY-MM-DD'
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  isCheckedIn: boolean;
}
```

### 5.2 组件拆分与职责

```
HabitTracker (根组件)
├── HabitList                    # 习惯列表面板
│   ├── HabitForm                # 创建/编辑习惯的内联表单
│   └── [习惯项] × N            # 单个习惯条目，点击切换
├── StatsBar                     # 统计栏：连续天数 + 本月完成率
├── CalendarNav                  # 月份导航：← 2026年2月 →
└── Calendar                     # 月历网格
    └── CalendarDay × 42         # 单日格子（6行×7列）
```

#### 组件通信方式

- **HabitList → HabitTracker**: 通过 Zustand store 中的 `selectedHabitId` 状态
- **Calendar → Store**: 点击日期触发 `toggleCheckIn` action
- **StatsBar**: 从 store 中派生计算（连续天数、完成率）

### 5.3 Zustand Store 设计

```typescript
// src/tools/habit-tracker/store/habit-store.ts

import { create } from 'zustand';
import { Habit, CheckIn, YearMonth } from '../types';
import { HabitService } from '../services/habit-service';

interface HabitStore {
  // —— 状态 ——
  habits: Habit[];
  selectedHabitId: string | null;
  currentMonth: YearMonth;          // '2026-02'
  checkIns: CheckIn[];              // 当前习惯 + 当前月的打卡记录
  loading: boolean;

  // —— 动作 ——
  loadHabits: () => Promise<void>;
  selectHabit: (id: string) => Promise<void>;
  setMonth: (month: YearMonth) => Promise<void>;
  createHabit: (name: string) => Promise<void>;
  updateHabit: (id: string, name: string) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  toggleCheckIn: (date: string) => Promise<void>;

  // —— 派生计算 ——
  getStreak: () => number;
  getMonthlyRate: () => number;
}
```

> 注：`getStreak` 和 `getMonthlyRate` 在 store 中作为方法暴露，内部基于 `checkIns` 和当前日期计算，不额外存储。

### 5.4 Service 层

```typescript
// src/tools/habit-tracker/services/habit-service.ts

import { DataStore } from '../../../platform/data/types';
import { Habit, CheckIn } from '../types';

export class HabitService {
  constructor(private store: DataStore) {}

  /** 获取所有未归档的习惯 */
  async getHabits(): Promise<Habit[]> {
    return this.store.query<Habit>('habits', {
      where: { archived: false },
      orderBy: 'createdAt',
      order: 'asc',
    });
  }

  /** 创建习惯 */
  async createHabit(name: string): Promise<Habit> {
    return this.store.create<Habit>('habits', { name, archived: false });
  }

  /** 更新习惯名称 */
  async updateHabit(id: string, name: string): Promise<Habit> {
    return this.store.update<Habit>('habits', id, { name });
  }

  /** 删除习惯（软删除 + 清理打卡记录） */
  async deleteHabit(id: string): Promise<void> {
    await this.store.update<Habit>('habits', id, { archived: true });
    await this.store.deleteWhere<CheckIn>('checkins', { habitId: id });
  }

  /** 获取某习惯某月的所有打卡记录 */
  async getCheckIns(habitId: string, yearMonth: string): Promise<CheckIn[]> {
    const all = await this.store.query<CheckIn>('checkins', {
      where: { habitId },
    });
    // 过滤月份（date 字段格式 YYYY-MM-DD，前缀匹配）
    return all.filter((c) => c.date.startsWith(yearMonth));
  }

  /** 获取某习惯的所有打卡日期（用于连续天数计算） */
  async getAllCheckInDates(habitId: string): Promise<string[]> {
    const all = await this.store.query<CheckIn>('checkins', {
      where: { habitId },
    });
    return all.map((c) => c.date).sort();
  }

  /** 切换打卡状态 */
  async toggleCheckIn(habitId: string, date: string): Promise<boolean> {
    // 检查是否已打卡
    const existing = await this.store.query<CheckIn>('checkins', {
      where: { habitId, date } as Partial<CheckIn>,
    });

    if (existing.length > 0) {
      // 已打卡 → 取消
      await this.store.delete('checkins', existing[0].id);
      return false;
    } else {
      // 未打卡 → 打卡
      await this.store.create<CheckIn>('checkins', { habitId, date });
      return true;
    }
  }
}
```

### 5.5 数据流

```
用户点击日历日期
    │
    ▼
CalendarDay.onClick(date)
    │
    ▼
habitStore.toggleCheckIn(date)
    │
    ▼
HabitService.toggleCheckIn(habitId, date)
    │
    ▼
DataStore.create/delete('checkins', ...)   ← IndexedDB 读写
    │
    ▼
habitStore 更新 checkIns 状态
    │
    ▼
React 重渲染：Calendar（打卡标记） + StatsBar（统计数字）
```

---

## 6. 关键实现细节

### 6.1 路由方案

使用 React Router 实现工具切换路由：

```typescript
// src/App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { DataStoreProvider } from './platform/data/data-context';
import { AppLayout } from './platform/layout/AppLayout';
import { toolRegistry } from './platform/registry/tool-registry';

export default function App() {
  const tools = toolRegistry.getAll();
  const defaultToolId = tools[0]?.id;

  return (
    <DataStoreProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            {tools.map((tool) => {
              const ToolComponent = tool.component;
              return (
                <Route
                  key={tool.id}
                  path={`/${tool.id}`}
                  element={
                    <Suspense fallback={<div>加载中...</div>}>
                      <ToolComponent />
                    </Suspense>
                  }
                />
              );
            })}
            {defaultToolId && (
              <Route
                path="*"
                element={<Navigate to={`/${defaultToolId}`} replace />}
              />
            )}
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </DataStoreProvider>
  );
}
```

路由结构：
- `/habit-tracker` → 日历打卡工具
- `/todo-list` → （未来）待办工具
- `/` → 重定向到第一个工具

### 6.2 主题与样式方案

#### 全局 CSS 变量

```css
/* src/platform/theme/variables.css */

:root {
  /* 色板 */
  --color-bg-primary: #FFFFFF;
  --color-bg-sidebar: #FAFAFA;
  --color-bg-hover: #F5F5F5;
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #666666;
  --color-text-disabled: #CCCCCC;
  --color-border: #E5E5E5;
  --color-accent: #000000;
  --color-accent-inverse: #FFFFFF;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;

  /* 动画 */
  --transition-fast: 150ms ease;

  /* 字体 */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;

  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* 侧边栏 */
  --sidebar-width: 200px;
  --sidebar-width-collapsed: 56px;
}
```

#### 样式使用方式

各组件使用 CSS Modules，引用全局变量：

```css
/* 示例：Calendar.module.css */
.day {
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
  color: var(--color-text-primary);
}

.day:hover:not(.disabled) {
  background-color: var(--color-bg-hover);
}

.dayCheckedIn::after {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-text-primary);
}

.dayToday {
  border: 2px solid var(--color-accent);
  font-weight: 600;
}

.dayFuture {
  color: var(--color-text-disabled);
  pointer-events: none;
}
```

### 6.3 全局类型定义

```typescript
// src/types/global.d.ts

/** CSS Modules 类型声明 */
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
```

### 6.4 Vite 配置

```typescript
// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@platform': path.resolve(__dirname, 'src/platform'),
      '@tools': path.resolve(__dirname, 'src/tools'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 每个工具单独打包为一个 chunk
        manualChunks(id) {
          if (id.includes('src/tools/')) {
            const toolName = id.split('src/tools/')[1].split('/')[0];
            return `tool-${toolName}`;
          }
        },
      },
    },
  },
});
```

---

## 7. 架构决策记录 (ADR)

### ADR-1: 为什么用单个 IndexedDB 表而不是每个命名空间一个表？

**决策**: 使用单一 `records` 表 + `_namespace` 字段。

**理由**:
- Dexie 的 schema 在 `version()` 中声明后就固定了，新增命名空间就要升级版本号 — 对"新增工具不修改平台代码"的目标不友好
- 单表 + 索引的查询性能对 MVP 数据量（几千条）完全够用
- 未来如果需要分表优化，可在 `DexieDataStore` 内部重构，不影响 `DataStore` 接口

### ADR-2: 为什么工具注册用命令式 `register()` 而不是声明式配置文件？

**决策**: 每个工具自己调用 `toolRegistry.register()`。

**理由**:
- 声明式 JSON 配置无法引用 `React.lazy` 组件
- 命令式注册让工具自包含：一个 `import` 就完成注册 + 懒加载声明
- TypeScript 类型检查可以确保 ToolDefinition 字段完整

### ADR-3: 为什么状态管理选 Zustand 而不是 React Context？

**决策**: Zustand。

**理由**:
- Context 变更会导致所有消费者重渲染，日历打卡场景中点击一个日期会触发整个组件树更新
- Zustand 支持 selector 精确订阅，只有依赖变更的组件才重渲染
- 各工具可以独立创建 store，无需在全局 Provider 层添加任何东西

---

## 8. 未来扩展考虑

| 场景 | 架构已具备的支撑 |
|------|-----------------|
| 新增工具 | 3 步接入，无需修改平台代码 |
| 后端同步 | 替换 `DataStore` 实现即可，上层零改动 |
| 跨工具数据引用 | `subscribe('*', ...)` 通配符监听 + 其他工具命名空间的 `query` |
| 暗色主题 | 在 `:root` 切换 CSS 变量值即可（预留了 `--color-*` 体系） |
| 数据导出/导入 | 在 `DataStore` 层新增 `exportAll()` / `importAll()` 方法 |
| 工具设置面板 | `ToolDefinition` 可扩展 `settingsComponent` 字段 |

---

## 附录：依赖清单

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "zustand": "^5.0.0",
    "dexie": "^4.0.0",
    "date-fns": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^6.0.0"
  }
}
```

总共 **6 个运行时依赖**，打包体积预估 < 80KB (gzipped)。

---

## 9. 变更记录 - v1.0.1 打卡频率支持

> 日期: 2026-02-17
> 关联 PRD: US-17 ~ US-21
> 影响范围: 数据模型、Service 层、Store 层、5 个 UI 组件 + 2 个 CSS 文件

### 9.1 变更概述

为习惯打卡工具新增 **打卡频率** 支持，允许用户创建 daily（每天）、weekly（每周）、monthly（每月）三种频率的习惯。核心改动：

1. Habit 实体增加 `frequency` 字段
2. 打卡完成判定从"按天"扩展为"按天/按周/按月"
3. 日历视图区分展示不同频率的完成状态
4. 统计指标适配频率维度

### 9.2 A. 数据模型变更

#### 文件: `src/tools/habit-tracker/types.ts`

**变更 1: 新增 HabitFrequency 类型**

```typescript
/** 打卡频率 */
export type HabitFrequency = 'daily' | 'weekly' | 'monthly';
```

**变更 2: Habit 接口增加 frequency 字段**

```typescript
export interface Habit extends BaseEntity {
  name: string;
  frequency: HabitFrequency;  // 新增，默认 'daily'
  archived: boolean;
}
```

向后兼容策略：已有数据中 `frequency` 为 `undefined` 时，前端一律视为 `'daily'`。在 HabitService 层做兜底处理。

**变更 3: CalendarDayData 增加频率相关渲染字段**

```typescript
export interface CalendarDayData {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  isCheckedIn: boolean;          // 该日期本身有打卡记录（实心标记）
  isPeriodCompleted: boolean;    // 新增：该日期所属周期（周/月）已完成（浅色背景）
}
```

`isPeriodCompleted` 含义：
- `daily` 习惯：始终等于 `isCheckedIn`（无额外效果）
- `weekly` 习惯：如果该天所在的自然周（周一~周日）内有任意一条打卡记录，为 `true`
- `monthly` 习惯：如果该天所在的自然月内有任意一条打卡记录，为 `true`

**变更 4: 新增频率显示标签映射常量**

```typescript
/** 频率的中文显示标签 */
export const FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  daily: '日',
  weekly: '周',
  monthly: '月',
};
```

### 9.3 B. HabitService 变更

#### 文件: `src/tools/habit-tracker/services/habit-service.ts`

**变更 1: createHabit — 增加 frequency 参数**

```typescript
// 变更前
async createHabit(name: string): Promise<Habit>

// 变更后
async createHabit(name: string, frequency: HabitFrequency = 'daily'): Promise<Habit> {
  return this.store.create<Habit>('habits', {
    name,
    frequency,
    archived: false,
  });
}
```

**变更 2: updateHabit — 支持修改 frequency**

```typescript
// 变更前
async updateHabit(id: string, name: string): Promise<Habit>

// 变更后
async updateHabit(
  id: string,
  data: { name?: string; frequency?: HabitFrequency }
): Promise<Habit> {
  return this.store.update<Habit>('habits', id, data);
}
```

**变更 3: getCheckIns — 周频率需扩大查询范围**

周任务的日历展示需要知道"日历中可见日期所在的自然周是否已完成"。当前实现按 `yearMonth` 前缀过滤，但日历中会显示上月末/下月初的日期（周边界溢出），需要把查询范围扩大。

```typescript
// 变更后签名
async getCheckIns(
  habitId: string,
  yearMonth: string,
  frequency: HabitFrequency = 'daily'
): Promise<CheckIn[]> {
  const all = await this.store.query<CheckIn>('checkins', {
    where: { habitId },
  });

  if (frequency === 'daily') {
    // 不变：仅匹配本月
    return all.filter((c) => c.date.startsWith(yearMonth));
  }

  if (frequency === 'weekly') {
    // 扩大范围：包含本月第一周的周一 ~ 最后一周的周日
    // 这些日期可能溢出到上月/下月
    const monthDate = parse(yearMonth, 'yyyy-MM', new Date());
    const rangeStart = format(
      startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 }),
      'yyyy-MM-dd'
    );
    const rangeEnd = format(
      endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 }),
      'yyyy-MM-dd'
    );
    return all.filter((c) => c.date >= rangeStart && c.date <= rangeEnd);
  }

  // monthly: 按月查询，与 daily 一致
  return all.filter((c) => c.date.startsWith(yearMonth));
}
```

**变更 4: 新增辅助方法 — 判断某周/某月是否已完成**

```typescript
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  format, parse,
} from 'date-fns';

/**
 * 判断给定日期所在的自然周是否有打卡记录
 * @param dateStr 日期 'YYYY-MM-DD'
 * @param checkInDates 该习惯的所有打卡日期集合
 */
isWeekCompleted(dateStr: string, checkInDates: Set<string>): boolean {
  const d = parse(dateStr, 'yyyy-MM-dd', new Date());
  const weekStart = startOfWeek(d, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(d, { weekStartsOn: 1 });
  const start = format(weekStart, 'yyyy-MM-dd');
  const end = format(weekEnd, 'yyyy-MM-dd');

  for (const date of checkInDates) {
    if (date >= start && date <= end) return true;
  }
  return false;
}

/**
 * 判断给定日期所在的自然月是否有打卡记录
 * @param dateStr 日期 'YYYY-MM-DD'
 * @param checkInDates 该习惯的所有打卡日期集合
 */
isMonthCompleted(dateStr: string, checkInDates: Set<string>): boolean {
  const yearMonth = dateStr.substring(0, 7); // 'YYYY-MM'
  for (const date of checkInDates) {
    if (date.startsWith(yearMonth)) return true;
  }
  return false;
}
```

**变更 5: toggleCheckIn — 逻辑不变**

打卡仍然是按具体日期操作（点击打卡/取消），无论频率如何。**不需改动**。

**变更 6: getAllCheckInDates — 不变**

该方法已返回所有打卡日期的排序列表，供 Store 层 `getStreak` 使用。**不需改动**。

### 9.4 C. habit-store 变更

#### 文件: `src/tools/habit-tracker/store/habit-store.ts`

**变更 1: Store 接口新增/修改方法签名**

```typescript
interface HabitStore {
  // ... 现有字段不变 ...

  // 动作签名变更
  createHabit: (name: string, frequency: HabitFrequency) => Promise<void>;
  updateHabit: (id: string, data: { name?: string; frequency?: HabitFrequency }) => Promise<void>;

  // 新增：获取当前选中习惯的 frequency（便捷方法）
  getSelectedFrequency: () => HabitFrequency;
}
```

**变更 2: createHabit 动作 — 透传 frequency**

```typescript
createHabit: async (name: string, frequency: HabitFrequency = 'daily') => {
  const service = get()._service;
  if (!service) return;

  const habit = await service.createHabit(name, frequency);
  await get().loadHabits();
  await get().selectHabit(habit.id);
},
```

**变更 3: updateHabit 动作 — 支持更新 frequency**

```typescript
updateHabit: async (id: string, data: { name?: string; frequency?: HabitFrequency }) => {
  const service = get()._service;
  if (!service) return;

  await service.updateHabit(id, data);
  await get().loadHabits();
},
```

**变更 4: selectHabit 和 setMonth — 传递 frequency**

需要在调用 `service.getCheckIns` 时传入当前习惯的 frequency：

```typescript
selectHabit: async (id: string) => {
  const service = get()._service;
  if (!service) return;

  set({ selectedHabitId: id, loading: true });
  const habit = get().habits.find((h) => h.id === id);
  const frequency = habit?.frequency ?? 'daily';
  const checkIns = await service.getCheckIns(id, get().currentMonth, frequency);
  set({ checkIns, loading: false });
},
```

`setMonth` 和 `loadHabits` 中调用 `getCheckIns` 的地方同理加上 frequency 参数。

**变更 5: getSelectedFrequency — 新增便捷方法**

```typescript
getSelectedFrequency: () => {
  const { habits, selectedHabitId } = get();
  const habit = habits.find((h) => h.id === selectedHabitId);
  return habit?.frequency ?? 'daily';
},
```

**变更 6: getStreak — 适配三种频率**

```typescript
getStreak: () => {
  const { checkIns, selectedHabitId, _service } = get();
  if (!selectedHabitId || !_service) return 0;

  const frequency = get().getSelectedFrequency();
  const checkedDates = new Set(checkIns.map((c) => c.date));
  const today = new Date();

  if (frequency === 'daily') {
    // 原逻辑不变：从今天往回逐天数
    let streak = 0;
    let current = today;
    let currentStr = format(current, 'yyyy-MM-dd');

    if (!checkedDates.has(currentStr)) {
      current = subDays(current, 1);
      currentStr = format(current, 'yyyy-MM-dd');
    }
    while (checkedDates.has(currentStr)) {
      streak++;
      current = subDays(current, 1);
      currentStr = format(current, 'yyyy-MM-dd');
    }
    return streak;
  }

  if (frequency === 'weekly') {
    // 从本周往回，逐周判断是否有打卡记录
    let streak = 0;
    let weekStart = startOfWeek(today, { weekStartsOn: 1 });

    // 本周尚未完成时，从上周开始数
    if (!_service.isWeekCompleted(format(weekStart, 'yyyy-MM-dd'), checkedDates)) {
      weekStart = subWeeks(weekStart, 1);
    }
    while (_service.isWeekCompleted(format(weekStart, 'yyyy-MM-dd'), checkedDates)) {
      streak++;
      weekStart = subWeeks(weekStart, 1);
    }
    return streak;
  }

  if (frequency === 'monthly') {
    // 从本月往回，逐月判断是否有打卡记录
    let streak = 0;
    let monthStart = startOfMonth(today);

    if (!_service.isMonthCompleted(format(monthStart, 'yyyy-MM-dd'), checkedDates)) {
      monthStart = subMonths(monthStart, 1);
    }
    while (_service.isMonthCompleted(format(monthStart, 'yyyy-MM-dd'), checkedDates)) {
      streak++;
      monthStart = subMonths(monthStart, 1);
    }
    return streak;
  }

  return 0;
},
```

> 注意：`getStreak` 当前基于 `checkIns`（当月数据）进行计算。对于 weekly/monthly 的跨月连续判断，MVP 阶段可能需要在 `selectHabit` 时额外加载更多月份的数据，或者改用 `getAllCheckInDates` 获取全量数据。**建议在 Store 中增加一个 `_allCheckInDates: Set<string>` 缓存，在 selectHabit 时加载一次，getStreak 基于此计算。**

**变更 7: getMonthlyRate — 适配三种频率**

```typescript
getMonthlyRate: () => {
  const { checkIns, currentMonth } = get();
  const frequency = get().getSelectedFrequency();
  const today = new Date();
  const currentYearMonth = format(today, 'yyyy-MM');

  if (frequency === 'daily') {
    // 原逻辑不变
    const [yearStr, monthStr] = currentMonth.split('-');
    const totalDays = getDaysInMonth(new Date(Number(yearStr), Number(monthStr) - 1));
    const effectiveDays = currentMonth === currentYearMonth
      ? today.getDate()
      : totalDays;
    if (effectiveDays === 0) return 0;
    return Math.round((checkIns.length / effectiveDays) * 100);
  }

  if (frequency === 'weekly') {
    // 本月周完成情况 = 已完成周数 / 已过周数（含本周）
    const [yearStr, monthStr] = currentMonth.split('-');
    const monthDate = new Date(Number(yearStr), Number(monthStr) - 1);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = currentMonth === currentYearMonth
      ? today
      : endOfMonth(monthDate);

    // 计算本月包含的自然周
    const checkedDates = new Set(checkIns.map((c) => c.date));
    let totalWeeks = 0;
    let completedWeeks = 0;
    let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });

    while (weekStart <= monthEnd) {
      // 只统计与本月有交集的周
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      if (weekEnd >= monthStart) {
        totalWeeks++;
        const wsStr = format(weekStart, 'yyyy-MM-dd');
        if (isWeekCompletedFromSet(wsStr, checkedDates)) {
          completedWeeks++;
        }
      }
      weekStart = addWeeks(weekStart, 1);
    }

    if (totalWeeks === 0) return 0;
    return Math.round((completedWeeks / totalWeeks) * 100);
  }

  if (frequency === 'monthly') {
    // 本月是否完成：0% 或 100%
    return checkIns.length > 0 ? 100 : 0;
  }

  return 0;
},
```

**变更 8: 新增 date-fns 导入**

```typescript
// 新增导入
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subWeeks, addWeeks, subMonths,
} from 'date-fns';
```

### 9.5 D. UI 组件变更清单

#### D1. HabitForm — 增加频率选择

**文件**: `src/tools/habit-tracker/components/HabitForm.tsx`

**Props 变更**:

```typescript
interface HabitFormProps {
  initialName?: string;
  initialFrequency?: HabitFrequency;  // 新增
  onSubmit: (name: string, frequency: HabitFrequency) => void;  // 签名变更
  onCancel: () => void;
  submitLabel?: string;
}
```

**新增 UI**: 在名称输入框下方，增加三个频率选择按钮（radio group 样式）：

```
[名称输入框                    ]
[ 每天 ○ ] [ 每周 ○ ] [ 每月 ○ ]    ← 新增行
[创建] [取消]
```

- 默认选中「每天」
- 编辑模式下回显当前频率
- 使用按钮组样式（类似 segmented control），三选一

**新增状态**:

```typescript
const [frequency, setFrequency] = useState<HabitFrequency>(initialFrequency ?? 'daily');
```

**CSS 新增样式** (HabitList.module.css):

```css
.frequencyGroup {
  display: flex;
  gap: 0;
  padding: 0 var(--spacing-md);
}

.frequencyOption {
  flex: 1;
  padding: var(--spacing-xs) 0;
  border: 1px solid var(--color-border);
  background: none;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.frequencyOption:first-child {
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.frequencyOption:last-child {
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.frequencyOption:not(:first-child) {
  border-left: none;
}

.frequencyOptionActive {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}
```

#### D2. HabitList — 显示频率标签

**文件**: `src/tools/habit-tracker/components/HabitList.tsx`

**变更点**:

1. 习惯名称旁显示频率标签 badge：

```tsx
// 在 .itemName 后面增加
<span className={styles.frequencyBadge}>
  {FREQUENCY_LABELS[habit.frequency ?? 'daily']}
</span>
```

2. `handleCreate` 和 `handleEdit` 传递 frequency:

```typescript
const handleCreate = async (name: string, frequency: HabitFrequency) => {
  await createHabit(name, frequency);
  setShowForm(false);
};

const handleEdit = async (name: string, frequency: HabitFrequency) => {
  if (editingId) {
    await updateHabit(editingId, { name, frequency });
    setEditingId(null);
  }
};
```

3. 编辑模式下传递 `initialFrequency`:

```tsx
<HabitForm
  initialName={habit.name}
  initialFrequency={habit.frequency ?? 'daily'}
  onSubmit={handleEdit}
  onCancel={() => setEditingId(null)}
  submitLabel="保存"
/>
```

**CSS 新增样式** (HabitList.module.css):

```css
.frequencyBadge {
  display: inline-block;
  margin-left: var(--spacing-xs);
  padding: 1px 6px;
  font-size: 11px;
  color: #999999;
  background-color: #F5F5F5;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.itemActive .frequencyBadge {
  color: rgba(255, 255, 255, 0.7);
  background-color: rgba(255, 255, 255, 0.15);
}
```

#### D3. Calendar — 传递频率信息，计算周期完成状态

**文件**: `src/tools/habit-tracker/components/Calendar.tsx`

**变更点**:

1. 从 Store 获取当前习惯频率:

```typescript
const getSelectedFrequency = useHabitStore((s) => s.getSelectedFrequency);
const frequency = getSelectedFrequency();
```

2. `buildCalendarDays` 增加 `frequency` + `checkedInDates` 参数，计算 `isPeriodCompleted`:

```typescript
function buildCalendarDays(
  yearMonth: YearMonth,
  checkedInDates: Set<string>,
  frequency: HabitFrequency    // 新增参数
): CalendarDayData[] {
  // ... 生成日期数组的逻辑不变 ...

  return eachDayOfInterval({ start: calStart, end: calEnd }).map((d) => {
    const dateStr = format(d, 'yyyy-MM-dd');
    const isCheckedIn = checkedInDates.has(dateStr);

    let isPeriodCompleted = false;
    if (frequency === 'daily') {
      isPeriodCompleted = isCheckedIn;
    } else if (frequency === 'weekly') {
      // 该天所在自然周是否有打卡
      isPeriodCompleted = isWeekCompletedFromSet(dateStr, checkedInDates);
    } else if (frequency === 'monthly') {
      // 该天所在自然月是否有打卡
      isPeriodCompleted = isMonthCompletedFromSet(dateStr, checkedInDates);
    }

    return {
      date: dateStr,
      dayOfMonth: d.getDate(),
      isCurrentMonth: isSameMonth(d, monthDate),
      isToday: isToday(d),
      isFuture: isFuture(d) && !isToday(d),
      isCheckedIn,
      isPeriodCompleted,
    };
  });
}
```

> `isWeekCompletedFromSet` 和 `isMonthCompletedFromSet` 可以作为纯函数直接在 Calendar.tsx 中定义（无需依赖 Service 实例），避免不必要的依赖。

3. **monthly 习惯**: 在日历顶部增加"本月已完成 ✓"标识:

```tsx
{frequency === 'monthly' && checkIns.length > 0 && (
  <div className={styles.monthCompletedBadge}>本月已完成 ✓</div>
)}
```

4. **weekly 习惯**: 日历网格中每周之间加细微间隔（通过 CSS 实现，周行间距加大）。

#### D4. CalendarDay — 增加周期完成背景

**文件**: `src/tools/habit-tracker/components/CalendarDay.tsx`

**变更点**: 根据 `isPeriodCompleted` 新增样式 class:

```typescript
const classes = [
  styles.day,
  !day.isCurrentMonth && styles.dayOutside,
  day.isToday && styles.dayToday,
  day.isFuture && styles.dayFuture,
  day.isCheckedIn && styles.dayCheckedIn,          // 实心标记
  day.isPeriodCompleted && !day.isCheckedIn && styles.dayPeriodCompleted,  // 浅色背景（非打卡日）
]
  .filter(Boolean)
  .join(' ');
```

**CSS 新增样式** (Calendar.module.css):

```css
/* 周/月完成时，该周期内非打卡日的浅色完成背景 */
.dayPeriodCompleted {
  background-color: #F0F0F0;
}

/* 月度完成标识 */
.monthCompletedBadge {
  text-align: center;
  padding: var(--spacing-xs) 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

/* weekly 习惯：周行之间加微间隔 */
.gridWeekly {
  row-gap: 4px;
}
```

#### D5. StatsBar — 根据频率显示不同统计文案

**文件**: `src/tools/habit-tracker/components/StatsBar.tsx`

**变更点**: 统计标签根据频率动态展示:

```typescript
import { useHabitStore } from '../store/habit-store';

export function StatsBar() {
  const getStreak = useHabitStore((s) => s.getStreak);
  const getMonthlyRate = useHabitStore((s) => s.getMonthlyRate);
  const getSelectedFrequency = useHabitStore((s) => s.getSelectedFrequency);

  const streak = getStreak();
  const monthlyRate = getMonthlyRate();
  const frequency = getSelectedFrequency();

  // 连续打卡标签
  const streakLabel = {
    daily: '连续打卡天数',
    weekly: '连续完成周数',
    monthly: '连续完成月数',
  }[frequency];

  // 完成率标签
  const rateLabel = {
    daily: '本月完成率',
    weekly: '本月周完成率',
    monthly: '本月完成状态',
  }[frequency];

  // monthly 的完成率显示为 "已完成" / "未完成" 而非百分比
  const rateDisplay = frequency === 'monthly'
    ? (monthlyRate > 0 ? '已完成' : '未完成')
    : `${monthlyRate}%`;

  return (
    <div className={styles.statsBar}>
      <div className={styles.statItem}>
        <span className={styles.statValue}>{streak}</span>
        <span className={styles.statLabel}>{streakLabel}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statValue}>{rateDisplay}</span>
        <span className={styles.statLabel}>{rateLabel}</span>
      </div>
    </div>
  );
}
```

#### D6. HabitTracker 根组件 — 首次创建习惯时传递 frequency

**文件**: `src/tools/habit-tracker/HabitTracker.tsx`

**变更点**: 首次创建流程的 `onSubmit` 适配新签名:

```typescript
<HabitForm
  onSubmit={async (name, frequency) => {
    await createHabit(name, frequency);
    setShowFirstForm(false);
  }}
  onCancel={() => setShowFirstForm(false)}
/>
```

### 9.6 E. 小I（后端/基础设施）和小F（前端/UI）分工指引

#### 小I 负责的文件（数据模型 + 业务逻辑层）

| 文件 | 改动内容 |
|------|---------|
| `types.ts` | 新增 `HabitFrequency` 类型、Habit 增加 `frequency` 字段、CalendarDayData 增加 `isPeriodCompleted`、新增 `FREQUENCY_LABELS` 常量 |
| `services/habit-service.ts` | `createHabit` 加 frequency 参数、`updateHabit` 改为接受 data 对象、`getCheckIns` 加 frequency 参数（weekly 扩大查询范围）、新增 `isWeekCompleted` / `isMonthCompleted` 辅助方法 |
| `store/habit-store.ts` | `createHabit` / `updateHabit` 签名变更、`selectHabit` / `setMonth` / `loadHabits` 传递 frequency、新增 `getSelectedFrequency`、重写 `getStreak` 和 `getMonthlyRate` 支持三频率、新增 date-fns 导入 |

小I 完成后需导出的新接口供小F 使用：
- `HabitFrequency` 类型
- `FREQUENCY_LABELS` 常量
- `habit.frequency` 字段（Habit 实体上）
- `CalendarDayData.isPeriodCompleted` 字段
- `useHabitStore` 中的 `getSelectedFrequency()` 方法
- `createHabit(name, frequency)` 新签名
- `updateHabit(id, { name?, frequency? })` 新签名

#### 小F 负责的文件（UI 组件 + 样式）

| 文件 | 改动内容 |
|------|---------|
| `components/HabitForm.tsx` | Props 增加 `initialFrequency`、`onSubmit` 签名变更、新增频率选择按钮组 UI |
| `components/HabitList.tsx` | 习惯条目显示频率 badge、`handleCreate`/`handleEdit` 传递 frequency、编辑时回显 frequency |
| `components/Calendar.tsx` | 从 Store 获取频率、`buildCalendarDays` 计算 `isPeriodCompleted`、monthly 增加顶部完成标识、weekly 增加周间距 |
| `components/CalendarDay.tsx` | 增加 `dayPeriodCompleted` 样式 class 判断 |
| `components/StatsBar.tsx` | 根据频率切换统计文案和显示方式 |
| `HabitTracker.tsx` | 首次创建流程适配 `(name, frequency)` 签名 |
| `styles/HabitList.module.css` | 新增 `.frequencyBadge`、`.frequencyGroup`、`.frequencyOption`、`.frequencyOptionActive` |
| `styles/Calendar.module.css` | 新增 `.dayPeriodCompleted`、`.monthCompletedBadge`、`.gridWeekly` |

#### 依赖关系与并行开发

```
小I (数据层) ──────────────────────> 导出类型和接口
       │                                │
       │  types.ts 先完成（约定接口）      │
       │                                │
       ▼                                ▼
小I: service + store              小F: 可先写 UI 骨架
       │                          （基于 types.ts 约定）
       │                                │
       └──── 合并后集成测试 ──────────────┘
```

**建议开发顺序**:
1. **小I 先完成 types.ts**（10 分钟），推送后小F 可并行开发 UI
2. **小I 完成 habit-service.ts**，再完成 **habit-store.ts**
3. **小F 并行完成** HabitForm → HabitList → StatsBar → Calendar/CalendarDay
4. **最后集成**：小F 对接小I 的 Store 方法，确认数据流通畅

### 9.7 风险与注意事项

1. **向后兼容**: 旧数据的 Habit 没有 `frequency` 字段，所有读取处必须兜底 `?? 'daily'`
2. **getStreak 跨月数据**: 当前 `checkIns` 仅包含当月数据，weekly/monthly 的连续计算需要更多月份的打卡记录。建议在 `selectHabit` 时通过 `getAllCheckInDates` 加载全量打卡日期到 Store 缓存
3. **日历性能**: `buildCalendarDays` 中为每个日期调用 `isWeekCompleted` 会有重复计算。可先预计算"已完成的周集合"再做 O(1) 查询
4. **IndexedDB 版本无需升级**: Habit 的 `frequency` 字段存储在 Dexie 的 schemaless 记录中，不需要升级数据库版本
