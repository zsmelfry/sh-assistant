# v3.0 改动说明书

> 对应 PRD: `docs/v3/PRD-v3.0-xiaoshuang-assistant.md`
> 基线: 当前 main 分支 (commit ee923ca)

---

## 改动总览

| # | 改动 | 类型 | 影响范围 | 复杂度 |
|---|------|------|---------|--------|
| 1 | 全局数据采集器 | 新增 | 后端 | ★★★ |
| 2 | 重写 coach chat prompt | 修改 | 后端 | ★★ |
| 3 | 全局聊天入口 | 新增 | 前端 | ★★★ |
| 4 | 仪表盘首页 | 新增 | 前端+后端 | ★★★ |
| 5 | 全局通知系统 | 修改 | 前端+后端 | ★★ |
| 6 | 里程碑逐级校验 | 修改 | 前端+后端 | ★ |
| 7 | 荣誉墙技能联动 | 修改 | 后端 | ★ |
| 8 | 统一活动日志 | 修改 | 后端 | ★★ |

建议实施顺序: 1 → 2 → 3 → 8 → 4 → 5 → 6 → 7

---

## 改动 1：全局数据采集器

### 目标

创建一个服务端模块，能从所有业务模块中采集数据摘要，供小爽助手和仪表盘使用。

### 新增文件

```
server/lib/coach/context-builder.ts    — 数据采集主模块
```

### 详细设计

```typescript
// server/lib/coach/context-builder.ts

interface GlobalContext {
  habits: HabitSummary | null;
  planner: PlannerSummary | null;
  vocab: VocabSummary | null;
  skillLearning: SkillLearningSummary | null;
  ability: AbilitySummary | null;
  articles: ArticleSummary | null;
  projects: ProjectSummary | null;
}

// 每个采集函数独立，按需调用
export async function collectHabitContext(db): Promise<HabitSummary>
// → 活跃习惯列表、各习惯今日是否完成、连续天数、本月完成率

export async function collectPlannerContext(db): Promise<PlannerSummary>
// → 域/目标数量、总完成率、本周到期检查项、逾期项

export async function collectVocabContext(db): Promise<VocabSummary>
// → 总词汇量、已掌握/学习中/未学习数量、待复习数、近7天正确率

export async function collectSkillLearningContext(db): Promise<SkillLearningSummary>
// → 各技能学习进度(知识点掌握百分比)、最近学习活动、streak

export async function collectAbilityContext(db): Promise<AbilitySummary>
// → 技能列表(名称+等级)、雷达图数据、焦点计划、近期里程碑进展

export async function collectArticleContext(db): Promise<ArticleSummary>
// → 最近阅读文章、书签数、标签分布

export async function collectProjectContext(db): Promise<ProjectSummary>
// → 活跃项目/里程碑数、逾期事项

// 智能选择：根据用户消息关键词决定加载哪些数据源
export async function collectRelevantContext(db, userMessage: string): Promise<Partial<GlobalContext>>

// 全量概要（用于仪表盘和"整体情况"类问题）
export async function collectFullSummary(db): Promise<GlobalContext>
```

### 关键词 → 数据源映射

```typescript
const CONTEXT_KEYWORDS: Record<string, (keyof GlobalContext)[]> = {
  // 习惯相关
  '习惯|打卡|坚持|连续|streak|日常': ['habits'],
  // 计划相关
  '计划|目标|进度|完成率|年度': ['planner'],
  // 法语/词汇相关
  '法语|词汇|单词|复习|SRS|背单词': ['vocab'],
  // 学习相关
  '学习|知识|课程|教程': ['skillLearning'],
  // 能力相关
  '能力|技能|等级|段位|雷达|里程碑|成长': ['ability'],
  // 阅读相关
  '文章|阅读|书签|读': ['articles'],
  // 项目相关
  '项目|事项|任务': ['projects'],
  // 全局
  '整体|全面|总结|回顾|情况|状态': ['habits', 'planner', 'vocab', 'skillLearning', 'ability'],
};
```

如果没有匹配关键词，默认加载 `habits` + `ability`（最常用）。

### 数据库查询

全部使用**只读查询**，不修改任何表。每个 collect 函数内部调用 `useDB()` 并查询对应 schema 的表。

---

## 改动 2：重写 coach chat prompt

### 目标

将 `buildCoachSystemPrompt` 从只读空数据升级为注入全局数据上下文。

### 修改文件

```
server/api/coach/chat.post.ts    — 主要修改
```

### 改动详情

**Before:**
```typescript
// 当前：只读 coach_profile(空) + memories + focus_plans(空)
const systemPrompt = buildCoachSystemPrompt(profile, memories, plans, context);
```

**After:**
```typescript
// 新：根据用户消息智能加载全局数据
import { collectRelevantContext } from '~/server/lib/coach/context-builder';

const globalContext = await collectRelevantContext(db, message);
const systemPrompt = buildCoachSystemPrompt(profile, memories, plans, globalContext, context);
```

**`buildCoachSystemPrompt` 改写要点：**

1. 人设从"个人能力教练"改为"小爽助手"
2. 注入 globalContext 各模块摘要（只注入非空的部分）
3. 保留现有原则（严格、诚实、具体建议）
4. 增加"模块关联分析"指令：鼓励 AI 把不同模块数据关联起来分析

**prompt 结构：**
```
## 你是小爽助手
[人设描述]

## 你的原则
[保留现有 + 补充]

## 用户画像
[coach_profile.content，如果非空]

## 用户当前数据
### 习惯打卡
[HabitSummary 摘要，如果加载了]

### 年度计划
[PlannerSummary 摘要，如果加载了]

### 词汇学习
[VocabSummary 摘要，如果加载了]

...（其他模块同理）

## 焦点计划
[现有 plans 数据]

## 历史记忆
[现有 memories 数据]

## 当前对话场景
[context]
```

---

## 改动 3：全局聊天入口

### 目标

小爽助手从能力画像内置面板升级为全局可呼出的聊天面板。

### 新增文件

```
components/XiaoshuangChat.vue      — 全局聊天面板组件
components/XiaoshuangButton.vue    — 侧边栏/浮动按钮
stores/xiaoshuang.ts               — 聊天状态管理
```

### 修改文件

```
layouts/default.vue                — 挂载全局聊天面板
components/AppSidebar.vue          — 添加小爽助手按钮
components/MobileBottomNav.vue     — 移动端添加浮动按钮
```

### 详细设计

**`stores/xiaoshuang.ts`**
```typescript
export const useXiaoshuangStore = defineStore('xiaoshuang', () => {
  const isOpen = ref(false);        // 面板是否展开
  const messages = ref<Message[]>([]); // 当前会话消息
  const isLoading = ref(false);
  const unreadCount = ref(0);       // 未读通知数

  function toggle() { isOpen.value = !isOpen.value; }
  function open() { isOpen.value = true; }
  function close() { isOpen.value = false; }

  async function send(message: string) {
    // POST /api/coach/chat with history
    // 与现有 CoachChatPanel 逻辑相同，但作为全局 store
  }

  async function loadPendingCount() {
    // GET /api/coach/pending → count
  }

  return { isOpen, messages, isLoading, unreadCount, toggle, open, close, send, loadPendingCount };
});
```

**`components/XiaoshuangChat.vue`**

- 右侧滑出面板（桌面端宽 400px，移动端全屏）
- 消息列表 + 输入框
- 复用现有 CoachChatPanel 的 UI 样式
- Ctrl+Enter 发送

**`layouts/default.vue` 改动**

```vue
<template>
  <div class="app-layout">
    <AppSidebar />
    <main class="main-content">
      <slot />
    </main>
    <!-- 新增：全局聊天面板 -->
    <XiaoshuangChat v-if="xiaoshuangStore.isOpen" />
  </div>
</template>
```

**`components/AppSidebar.vue` 改动**

在现有 footer 区域（LLM 设置按钮上方）添加小爽助手按钮：
```vue
<button class="sidebar-xiaoshuang" @click="xiaoshuangStore.toggle()">
  <MessageCircle :size="20" />
  <span v-if="!collapsed">小爽助手</span>
  <span v-if="xiaoshuangStore.unreadCount > 0" class="badge">
    {{ xiaoshuangStore.unreadCount > 9 ? '9+' : xiaoshuangStore.unreadCount }}
  </span>
</button>
```

### 与现有 CoachChatPanel 的关系

`tools/ability-profile/components/CoachChatPanel.vue` 保留，但改为调用 `useXiaoshuangStore`。能力画像中点击"AI 教练"按钮时，打开全局面板而非内置面板。

---

## 改动 4：仪表盘首页

### 目标

新建 dashboard 工具作为默认着陆页，替代能力画像。

### 新增文件

```
tools/dashboard/index.ts                      — 工具注册 (order: 0)
tools/dashboard/Dashboard.vue                 — 主组件
tools/dashboard/components/GreetingBanner.vue  — 问候横幅
tools/dashboard/components/TodayAgenda.vue     — 今日议程
tools/dashboard/components/DailyInsight.vue    — 每日一言
tools/dashboard/components/QuickStats.vue      — 数据概览行
tools/dashboard/components/RecentActivity.vue  — 最近动态时间线
tools/dashboard/types.ts                       — 类型定义
```

### 新增 API

```
server/api/dashboard/summary.get.ts    — 仪表盘聚合数据
server/api/dashboard/insight.get.ts    — 每日一言（LLM生成，带缓存）
server/api/dashboard/activity.get.ts   — 最近跨模块活动
```

### 修改文件

```
tools/index.ts                          — 添加 dashboard side-effect import
tools/ability-profile/index.ts          — order 从 0 改为 1
```

**`server/api/dashboard/summary.get.ts`**

调用 `collectFullSummary(db)` 返回所有模块的概要数据。前端一个 API 调用拿到全部仪表盘数据。

**`server/api/dashboard/insight.get.ts`**

```typescript
// 检查今日是否已生成 → 有则返回缓存
// 无则调用 LLM 生成一句话洞察 → 存入 coach_daily_insights 表 → 返回
// 表结构: { id, date (YYYY-MM-DD, unique), content, createdAt }
```

### 新增 DB 表

```sql
CREATE TABLE coach_daily_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,           -- YYYY-MM-DD
  content TEXT NOT NULL,               -- 生成的每日一言
  created_at INTEGER NOT NULL          -- Unix ms
);
```

### 工具注册

```typescript
// tools/dashboard/index.ts
registerTool({
  id: 'dashboard',
  name: '今日',
  icon: 'Home',
  order: 0,
  component: () => import('./Dashboard.vue'),
  namespaces: ['dashboard'],
});
```

能力画像 order 从 0 改为 1，确保仪表盘排第一。

---

## 改动 5：全局通知系统

### 目标

通知从能力画像内部提升为系统级，覆盖所有模块。

### 修改文件

```
server/api/coach/pending.get.ts         — 扩展通知来源
components/AppSidebar.vue               — 通知角标移到小爽按钮
tools/ability-profile/AbilityProfile.vue — 移除独占通知逻辑
```

### `pending.get.ts` 扩展

现有逻辑保留（DB 通知 + 技能停滞 + 状态过期），新增：

```typescript
// 新增虚拟通知生成

// 1. 习惯断签风险
// 查询有连续记录但今日未打卡的习惯（晚8点后触发）
// priority: high

// 2. 年度计划逾期
// 查询到期日 < 今天且未完成的检查项
// priority: high

// 3. SRS 待复习积压
// 查询待复习词汇数 > 20
// priority: medium

// 4. 连续记录创新高（正向通知）
// 查询今日 streak 创新高的习惯
// priority: low, positiveType: true
```

### 通知角标迁移

**Before:** 角标在 AppSidebar 的 ability-profile 工具图标上
**After:** 角标在 AppSidebar 的小爽助手按钮上

`stores/xiaoshuang.ts` 的 `loadPendingCount()` 在 layout mount 时调用，每 5 分钟刷新。

---

## 改动 6：里程碑逐级校验

### 目标

不允许跳过低 tier 直接完成高 tier 里程碑。

### 修改文件

```
server/api/ability-skills/[skillId]/milestones/[milestoneId]/complete.post.ts
tools/ability-profile/components/MilestoneItem.vue
```

### 后端改动

在 `complete.post.ts` 的现有校验之后、创建 completion 之前，增加：

```typescript
// 获取当前里程碑的 tier
const milestone = await db.select()...;

if (milestone.tier > 1) {
  // 查询前一个 tier 的所有里程碑
  const prevTierMilestones = await db.select()
    .from(milestones)
    .where(and(
      eq(milestones.skillId, skillId),
      eq(milestones.tier, milestone.tier - 1)
    ));

  // 查询它们的完成状态
  const prevTierCompletions = await db.select()
    .from(milestoneCompletions)
    .where(inArray(milestoneCompletions.milestoneId, prevTierMilestones.map(m => m.id)));

  // 如果前一个 tier 有未完成的里程碑，拒绝
  if (prevTierCompletions.length < prevTierMilestones.length) {
    throw createError({
      statusCode: 400,
      message: `需先完成${TIER_NAMES[milestone.tier - 1]}段位的所有里程碑`,
    });
  }
}
```

### 前端改动

`MilestoneItem.vue` 接收新 prop `locked: boolean`：

```vue
<template>
  <div :class="['milestone-item', { locked }]">
    <Lock v-if="locked" :size="14" class="lock-icon" />
    <!-- 现有内容 -->
    <button v-if="!locked" @click="complete">完成</button>
    <span v-else class="locked-hint">需先完成上一段位</span>
  </div>
</template>
```

父组件计算 locked 状态：一个里程碑 locked 当且仅当其 tier > 1 且前一个 tier 存在未完成里程碑。

---

## 改动 7：荣誉墙技能联动

### 目标

技能创建/删除时同步检查徽章状态。

### 修改文件

```
server/api/ability-skills/index.post.ts      — 创建技能后触发徽章检查
server/api/ability-skills/[skillId].delete.ts — 删除技能后标记历史徽章
server/lib/ability/badge-check.ts             — 增加创建/删除场景的检查函数
server/database/schemas/coach.ts              — badgeAwards 增加 historical 字段
```

### Schema 改动

```typescript
// badgeAwards 表增加字段
historical: integer('historical').notNull().default(0),
// 0 = 当前有效, 1 = 历史成就（技能删除后条件不再满足）
```

需要生成新的 migration。

### 创建技能后

在 `index.post.ts` 的 return 之前：

```typescript
import { checkBadgesOnSkillChange } from '~/server/lib/ability/badge-check';
await checkBadgesOnSkillChange(db, 'create');
```

### 删除技能后

在 `[skillId].delete.ts` 的 return 之前：

```typescript
await checkBadgesOnSkillChange(db, 'delete');
```

### `badge-check.ts` 新增函数

```typescript
export async function checkBadgesOnSkillChange(db, action: 'create' | 'delete') {
  if (action === 'create') {
    // 检查 lifelong_learner (3+ 活跃技能)
    // 检查 polymath (5+ 大类各有 tier 2+)
    // 已有 checkAndAwardBadges 逻辑可复用
  }

  if (action === 'delete') {
    // 获取所有已授予的徽章
    // 对每个徽章重新校验条件
    // 不满足的标记 historical = 1
  }
}
```

---

## 改动 8：统一活动日志

### 目标

扩展现有 `activityLogs` 表，接入更多模块的关键活动。

### 修改文件

```
server/api/checkins/toggle.post.ts              — 打卡时写入活动日志
server/api/planner/check-items/[id].patch.ts     — 完成检查项时写入
server/api/vocab/progress.post.ts                — 学习/复习词汇时写入
server/api/articles/[id]/read.post.ts            — 阅读完成时写入（如有）
server/lib/ability/log-activity.ts               — 扩展 source 类型
```

### 新增 API

```
server/api/dashboard/activity.get.ts  — 查询最近跨模块活动（改动4中已提及）
```

### 活动日志格式

```typescript
// 打卡
{ source: 'habit', sourceRef: `habit:${habitId}`, description: '完成习惯打卡「晨跑」', date: 'YYYY-MM-DD' }

// 计划
{ source: 'planner', sourceRef: `check-item:${id}`, description: '完成检查项「完成 React 课程」', date: 'YYYY-MM-DD' }

// 词汇
{ source: 'vocab', sourceRef: null, description: '学习了 15 个新法语词汇', date: 'YYYY-MM-DD' }

// 文章
{ source: 'article', sourceRef: `article:${id}`, description: '阅读完成「标题」', date: 'YYYY-MM-DD' }
```

### 查询 API

```typescript
// GET /api/dashboard/activity?limit=10&from=&to=
// 返回 activityLogs 按 createdAt desc 排序，limit 默认 10
```

---

## 数据库 Migration 汇总

| 表 | 操作 | 说明 |
|----|------|------|
| `coach_daily_insights` | CREATE | 每日一言缓存 |
| `badge_awards` | ALTER | 增加 `historical` 列 (integer, default 0) |

运行 `npm run db:generate` 生成 migration，`npm run db:migrate` 应用。

---

## 不需要改的部分

| 模块 | 说明 |
|------|------|
| 习惯打卡 UI | 功能不变，只在 toggle 时额外写一条活动日志 |
| 年度计划 UI | 功能不变，只在完成检查项时额外写一条活动日志 |
| 法语词汇 UI | 功能不变，只在学习/复习时额外写一条活动日志 |
| 文章阅读 UI | 功能不变 |
| 技能学习 UI | 功能不变（已有活动日志机制） |
| 登录/认证 | 不变 |
| LLM 配置 | 不变 |
| PM2 部署 | 不变 |

---

## 文件改动清单

### 新增文件 (16)

| 文件 | 用途 |
|------|------|
| `server/lib/coach/context-builder.ts` | 全局数据采集器 |
| `server/api/dashboard/summary.get.ts` | 仪表盘聚合 API |
| `server/api/dashboard/insight.get.ts` | 每日一言 API |
| `server/api/dashboard/activity.get.ts` | 跨模块活动 API |
| `components/XiaoshuangChat.vue` | 全局聊天面板 |
| `components/XiaoshuangButton.vue` | 聊天按钮 |
| `stores/xiaoshuang.ts` | 聊天状态 store |
| `tools/dashboard/index.ts` | 仪表盘工具注册 |
| `tools/dashboard/Dashboard.vue` | 仪表盘主组件 |
| `tools/dashboard/components/GreetingBanner.vue` | 问候横幅 |
| `tools/dashboard/components/TodayAgenda.vue` | 今日议程 |
| `tools/dashboard/components/DailyInsight.vue` | 每日一言 |
| `tools/dashboard/components/QuickStats.vue` | 数据概览 |
| `tools/dashboard/components/RecentActivity.vue` | 最近动态 |
| `tools/dashboard/types.ts` | 类型定义 |
| `server/database/schemas/dashboard.ts` | daily_insights 表 schema |

### 修改文件 (14)

| 文件 | 改动内容 |
|------|---------|
| `server/api/coach/chat.post.ts` | 重写 prompt + 注入全局上下文 |
| `server/api/coach/pending.get.ts` | 扩展通知来源 |
| `server/api/ability-skills/[skillId]/milestones/[milestoneId]/complete.post.ts` | 增加 tier 前置校验 |
| `server/api/ability-skills/index.post.ts` | 创建技能后检查徽章 |
| `server/api/ability-skills/[skillId].delete.ts` | 删除技能后标记历史徽章 |
| `server/api/checkins/toggle.post.ts` | 写入活动日志 |
| `server/api/planner/check-items/[id].patch.ts` | 写入活动日志 |
| `server/lib/ability/badge-check.ts` | 增加技能变更检查函数 |
| `server/database/schemas/coach.ts` | badgeAwards 增加 historical 字段 |
| `layouts/default.vue` | 挂载全局聊天面板 |
| `components/AppSidebar.vue` | 添加小爽按钮 + 通知角标迁移 |
| `components/MobileBottomNav.vue` | 移动端小爽按钮 |
| `tools/index.ts` | 添加 dashboard import |
| `tools/ability-profile/index.ts` | order 从 0 改为 1 |
| `tools/ability-profile/components/MilestoneItem.vue` | 增加 locked 状态 |
| `tools/ability-profile/AbilityProfile.vue` | coach 入口改为全局面板 |
