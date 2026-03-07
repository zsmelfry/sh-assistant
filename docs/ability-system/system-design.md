# 能力画像系统 — 系统设计书

## 概述

本文档指导能力画像系统的技术实现。遵循项目现有架构约定（Nuxt 3 SPA + SQLite/Drizzle + Pinia + 工具插件系统）。

核心数据流：
```
技能（用户添加）
  → 里程碑（模板/AI/自定义）
    → 完成 + 验证
      → 段位解锁
        → 雷达图自动聚合
```

---

## 一、数据库设计

### 新增 Schema 文件：`server/database/schemas/ability.ts`

```
abilityCategories (7个能力大类 — 雷达图维度, 系统预置不可改)
├── id: integer, PK
├── name: text, NOT NULL, UNIQUE     -- "语言能力"
├── description: text                -- "母语及外语的听说读写"
├── icon: text | null
├── sortOrder: integer, default 0
├── createdAt: integer, NOT NULL     -- Unix ms

预置7条，不提供用户CRUD
```

```
skills (用户的具体技能)
├── id: integer, PK
├── categoryId: integer, NOT NULL, FK → abilityCategories(id)
├── name: text, NOT NULL              -- "法语"、"跑步"、"吉他"
├── description: text | null
├── icon: text | null
├── source: text, NOT NULL            -- 'template' | 'ai' | 'custom'
├── templateId: text | null           -- 引用官方模板 ID（如 'french', 'running'）
├── currentTier: integer, NOT NULL, default 0   -- 0=未开始, 1-5=入门~卓越
├── status: text, NOT NULL, default 'active'    -- 'active' | 'paused'
├── sortOrder: integer, default 0
├── createdAt: integer, NOT NULL
├── updatedAt: integer, NOT NULL

索引: categoryId, status, templateId
```

```
milestones (里程碑)
├── id: integer, PK
├── skillId: integer, NOT NULL, FK → skills(id), CASCADE
├── tier: integer, NOT NULL           -- 1-5 对应入门~卓越
├── title: text, NOT NULL             -- "掌握 500 词"
├── description: text | null          -- 详细说明/达标标准
├── milestoneType: text, NOT NULL     -- 'quantity' | 'consistency' | 'achievement' | 'quality'
├── verifyMethod: text, NOT NULL      -- 'platform_auto' | 'platform_test' | 'evidence' | 'self_declare'
├── verifyConfig: text | null         -- JSON: 自动验证配置（见下方说明）
├── sortOrder: integer, default 0
├── createdAt: integer, NOT NULL
├── updatedAt: integer, NOT NULL

索引: skillId, tier
```

`verifyConfig` JSON 结构，按 verifyMethod 不同：

```jsonc
// platform_auto: 平台自动判定
{ "source": "vocab", "metric": "mastered_count", "threshold": 500 }
{ "source": "habit", "habitId": "uuid", "metric": "streak_weeks", "threshold": 12 }
{ "source": "skill_learning", "skillId": "music-ear", "metric": "practiced_rate", "threshold": 0.8 }

// platform_test: 平台内触发测试
{ "testType": "vocab_quiz", "sampleSize": 50, "passRate": 0.8 }
{ "testType": "reading_comprehension", "level": "intermediate" }

// evidence: 需要用户提交证据
{ "evidenceType": "certificate", "description": "上传 DELF B1 成绩单" }
{ "evidenceType": "screenshot", "description": "运动app跑步记录截图" }
{ "evidenceType": "link", "description": "作品链接" }

// self_declare: 用户自证声明
{ "prompt": "确认你能在10人以上场合完成3分钟演讲" }
```

```
milestoneCompletions (里程碑完成记录)
├── id: integer, PK
├── milestoneId: integer, NOT NULL, FK → milestones(id), CASCADE, UNIQUE
├── verifyMethod: text, NOT NULL      -- 实际使用的验证方式
├── evidenceUrl: text | null          -- 证据链接/截图路径
├── evidenceNote: text | null         -- 补充说明
├── verifiedAt: integer, NOT NULL     -- Unix ms
├── createdAt: integer, NOT NULL

索引: milestoneId (unique)
```

```
skillCurrentState (技能当前状态 — 区别于历史成就)
├── id: integer, PK
├── skillId: integer, NOT NULL, FK → skills(id), CASCADE
├── stateKey: text, NOT NULL          -- "single_run_km", "weekly_frequency", "pace_per_km"
├── stateValue: text, NOT NULL        -- "10", "3", "6:30"
├── stateLabel: text, NOT NULL        -- "单次跑步能力", "每周频率", "配速"
├── source: text, NOT NULL            -- 'platform_auto' | 'user_confirmed'
├── confirmedAt: integer, NOT NULL    -- 上次确认时间 Unix ms
├── expiresAfterDays: integer, default 180  -- 过期天数，0=不过期
├── createdAt: integer, NOT NULL
├── updatedAt: integer, NOT NULL

索引: skillId, (skillId, stateKey) UNIQUE
```

```
skillSnapshots (月度雷达快照)
├── id: integer, PK
├── date: text, NOT NULL, UNIQUE      -- 'YYYY-MM-DD' (每月1号)
├── radarData: text, NOT NULL         -- JSON: {categoryId: score, ...}
├── skillData: text, NOT NULL         -- JSON: {skillId: {tier, states}, ...}
├── createdAt: integer, NOT NULL

索引: date (unique)
```

```
badges (徽章定义)
├── id: integer, PK
├── key: text, NOT NULL, UNIQUE       -- 'marathon_finisher', 'vocab_10k'
├── name: text, NOT NULL              -- "全马完赛者"
├── description: text, NOT NULL       -- "完成42公里马拉松"
├── icon: text | null
├── rarity: text, default 'common'   -- 'common' | 'rare' | 'epic' | 'legendary'
├── createdAt: integer, NOT NULL

预置 + 可扩展
```

```
badgeAwards (用户获得的徽章)
├── id: integer, PK
├── badgeId: integer, NOT NULL, FK → badges(id), CASCADE
├── skillId: integer | null, FK → skills(id), SET NULL   -- 关联技能
├── milestoneId: integer | null, FK → milestones(id), SET NULL  -- 触发的里程碑
├── awardedAt: integer, NOT NULL
├── createdAt: integer, NOT NULL

索引: badgeId, (badgeId) UNIQUE per badge — 每个徽章只能获得一次
```

```
activityLogs (活动日志 — 来自各模块 + 手动)
├── id: integer, PK
├── skillId: integer | null, FK → skills(id), SET NULL
├── categoryId: integer | null, FK → abilityCategories(id), SET NULL
├── source: text, NOT NULL            -- 'habit' | 'skill_learning' | 'vocab' | 'planner' | 'article' | 'manual' | 'milestone'
├── sourceRef: text | null            -- 来源模块内的 ID
├── description: text, NOT NULL       -- "完成里程碑：掌握500词"
├── date: text, NOT NULL              -- 'YYYY-MM-DD'
├── createdAt: integer, NOT NULL

索引: skillId, date, source, categoryId
```

```
focusPlans (焦点提升计划, 最多3个active)
├── id: integer, PK
├── skillId: integer, NOT NULL, FK → skills(id), CASCADE
├── currentTier: integer, NOT NULL    -- 创建时的段位
├── targetTier: integer, NOT NULL     -- 目标段位
├── targetDate: text, NOT NULL        -- 'YYYY-MM-DD'
├── strategy: text | null             -- AI 生成的提升方案 (Markdown)
├── linkedHabitIds: text | null       -- JSON: UUID[]
├── linkedPlannerGoalIds: text | null -- JSON: integer[]
├── linkedSkillLearningIds: text | null -- JSON: string[]
├── status: text, default 'active'    -- 'active' | 'achieved' | 'abandoned'
├── createdAt: integer, NOT NULL
├── updatedAt: integer, NOT NULL

索引: status, skillId
约束: active 状态最多 3 条（应用层校验）
```

### 新增 Schema 文件：`server/database/schemas/coach.ts`

```
coachProfile (用户画像, 单条记录)
├── id: integer, PK, default 1
├── content: text, NOT NULL, default ''      -- L0 画像 Markdown
├── currentFocus: text, NOT NULL, default '' -- L1 焦点 Markdown
├── version: integer, NOT NULL, default 0
├── updatedAt: integer, NOT NULL

无外键，全表只有一行
```

```
coachConversations (完整对话记录, L3)
├── id: integer, PK
├── context: text, NOT NULL       -- 'onboarding' | 'coaching' | 'weekly_review' | 'monthly_review' | 'chat'
├── skillId: integer | null, FK → skills(id), SET NULL
├── messages: text, NOT NULL      -- JSON: [{role, content}]
├── createdAt: integer, NOT NULL

索引: context, skillId, createdAt
```

```
coachMemories (对话摘要, L2)
├── id: integer, PK
├── conversationId: integer, FK → coachConversations(id), CASCADE
├── summary: text, NOT NULL           -- 3-5 句话
├── skillTags: text, NOT NULL         -- JSON: integer[] (skillId 列表)
├── categoryTags: text, NOT NULL      -- JSON: integer[] (categoryId 列表)
├── memoryType: text, NOT NULL        -- 'onboarding' | 'coaching' | 'review' | 'insight'
├── importance: integer, default 3    -- 1-5
├── createdAt: integer, NOT NULL

索引: memoryType, importance, createdAt
```

```
coachNotifications (主动通知)
├── id: integer, PK
├── type: text, NOT NULL          -- 'daily_focus' | 'reminder' | 'warning' | 'weekly_review'
│                                    'monthly_report' | 'milestone_achieved' | 'tier_unlocked'
│                                    'badge_awarded' | 'stagnation' | 'state_expiring'
├── title: text, NOT NULL
├── content: text, NOT NULL
├── priority: text, default 'medium'  -- 'low' | 'medium' | 'high'
├── skillId: integer | null, FK → skills(id), SET NULL
├── actionType: text | null       -- 'view_skill' | 'chat' | 'confirm_state' | 'review' | 'dismiss'
├── actionUrl: text | null
├── status: text, default 'pending'   -- 'pending' | 'read' | 'acted' | 'dismissed'
├── scheduledFor: integer, NOT NULL   -- Unix ms
├── expiresAt: integer | null         -- Unix ms
├── createdAt: integer, NOT NULL

索引: status, scheduledFor, type
```

```
coachProfileChanges (画像变更审计)
├── id: integer, PK
├── field: text, NOT NULL
├── previousValue: text
├── newValue: text
├── reason: text, NOT NULL
├── sourceConversationId: integer | null, FK → coachConversations(id), SET NULL
├── createdAt: integer, NOT NULL
```

---

## 二、API 路由设计

### 能力大类 `/api/ability-categories/`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ability-categories` | 获取7个大类 |

只读，不提供 CUD。

### 技能 `/api/skills/` (注意：与现有 `/api/skills/[skillId]/` 技能学习路由不冲突，这里用 `/api/ability-skills/`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ability-skills` | 获取用户所有技能（含 currentTier, milestones 统计） |
| GET | `/api/ability-skills/:id` | 技能详情（含全部 milestones, completions, currentState） |
| POST | `/api/ability-skills` | 创建技能（从模板/AI/自定义） |
| PATCH | `/api/ability-skills/:id` | 编辑技能（名称、描述、状态） |
| DELETE | `/api/ability-skills/:id` | 删除技能（级联删除 milestones） |
| POST | `/api/ability-skills/onboard` | AI 快速建档（批量创建技能+设置初始状态） |

### 里程碑 `/api/ability-skills/:skillId/milestones/`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ability-skills/:skillId/milestones` | 获取技能的所有里程碑 |
| POST | `/api/ability-skills/:skillId/milestones` | 添加里程碑（手动） |
| PATCH | `/api/ability-skills/:skillId/milestones/:id` | 编辑里程碑 |
| DELETE | `/api/ability-skills/:skillId/milestones/:id` | 删除未完成的里程碑 |
| POST | `/api/ability-skills/:skillId/milestones/generate` | AI 生成里程碑体系 |
| POST | `/api/ability-skills/:skillId/milestones/:id/complete` | 完成里程碑（提交验证） |
| POST | `/api/ability-skills/:skillId/milestones/:id/verify` | 触发平台验证（测试/抽查） |

### 当前状态 `/api/ability-skills/:skillId/states/`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ability-skills/:skillId/states` | 获取技能当前状态列表 |
| PUT | `/api/ability-skills/:skillId/states` | 批量更新当前状态（确认/修改） |

### 焦点计划 `/api/focus-plans/`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/focus-plans` | 获取所有焦点计划（默认 active） |
| POST | `/api/focus-plans` | 创建焦点计划（校验 active ≤ 3） |
| PATCH | `/api/focus-plans/:id` | 更新计划 |
| DELETE | `/api/focus-plans/:id` | 删除计划 |
| POST | `/api/focus-plans/:id/generate-strategy` | AI 生成提升策略 |

### 统计与雷达 `/api/ability-stats/`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ability-stats/radar` | 雷达图数据（7大类得分） |
| GET | `/api/ability-stats/snapshots?from=&to=` | 历史快照 |
| GET | `/api/ability-stats/activities?skillId=&from=&to=` | 活动日志 |

### 徽章 `/api/badges/`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/badges` | 所有徽章定义 + 用户获得状态 |
| GET | `/api/badges/awarded` | 用户已获得的徽章 |

### 教练 `/api/coach/`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/coach/profile` | 获取教练画像（L0+L1） |
| PUT | `/api/coach/profile` | 手动编辑画像 |
| POST | `/api/coach/chat` | 教练对话（自动注入记忆上下文） |
| GET | `/api/coach/conversations` | 对话历史列表（分页） |
| GET | `/api/coach/conversations/:id` | 单次对话详情 |
| GET | `/api/coach/pending` | 获取待处理通知（登录时调用） |
| PATCH | `/api/coach/notifications/:id` | 更新通知状态 |
| POST | `/api/coach/run-scheduled` | 触发定时任务检查（cron 调用） |

### 技能模板 `/api/skill-templates/`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/skill-templates` | 获取所有官方模板列表 |
| GET | `/api/skill-templates/:templateId` | 获取模板详情（含里程碑定义） |

---

## 三、雷达图计算逻辑

### `server/lib/ability/radar.ts`

```typescript
interface RadarPoint {
  categoryId: number
  categoryName: string
  score: number           // 0-100
  skillCount: number      // 该类下技能数量
  sufficient: boolean     // skillCount >= 2
}

function calculateRadar(skills: Skill[]): RadarPoint[] {
  const grouped = groupBy(skills.filter(s => s.status === 'active'), 'categoryId')

  return categories.map(cat => {
    const catSkills = grouped[cat.id] || []
    if (catSkills.length === 0) {
      return { categoryId: cat.id, categoryName: cat.name, score: 0, skillCount: 0, sufficient: false }
    }

    // 每个技能的得分 = currentTier * 20 (1星=20, 5星=100)
    // 考虑当前状态过期：过期的状态降权
    const scores = catSkills.map(skill => {
      const baseScore = skill.currentTier * 20
      const hasExpiredStates = skill.states.some(s => isExpired(s))
      return hasExpiredStates ? baseScore * 0.7 : baseScore  // 有过期状态的技能降权30%
    })

    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      score: avgScore,
      skillCount: catSkills.length,
      sufficient: catSkills.length >= 2
    }
  })
}
```

### 段位解锁判定

```typescript
// 当一个 tier 的所有里程碑都有 completion 记录时，自动升级 skill.currentTier
async function checkTierUnlock(skillId: number): Promise<boolean> {
  const skill = await getSkill(skillId)
  const nextTier = skill.currentTier + 1
  if (nextTier > 5) return false

  const milestones = await getMilestonesByTier(skillId, nextTier)
  if (milestones.length === 0) return false

  const allCompleted = milestones.every(m => m.completion !== null)
  if (allCompleted) {
    await updateSkillTier(skillId, nextTier)
    await checkBadgeAwards(skillId, nextTier)  // 检查是否触发徽章
    await logActivity(skillId, 'milestone', `段位解锁：${TIER_NAMES[nextTier]}`)
    return true
  }
  return false
}
```

---

## 四、里程碑验证实现

### `server/lib/ability/verify.ts`

```typescript
interface VerifyResult {
  passed: boolean
  score?: number        // 测试类验证的得分
  detail?: string       // 验证详情
}

// 平台自动验证 — 查询各模块数据
async function verifyPlatformAuto(milestone: Milestone): Promise<VerifyResult> {
  const config = JSON.parse(milestone.verifyConfig)

  switch (config.source) {
    case 'vocab': {
      const count = await getVocabMasteredCount()
      return { passed: count >= config.threshold, score: count, detail: `已掌握 ${count} 词` }
    }
    case 'habit': {
      const streak = await getHabitStreak(config.habitId, config.metric)
      return { passed: streak >= config.threshold, score: streak }
    }
    case 'skill_learning': {
      const rate = await getSkillLearningRate(config.skillId, config.metric)
      return { passed: rate >= config.threshold, score: rate }
    }
  }
}

// 平台验证（测试）— 生成并执行测试
async function verifyPlatformTest(milestone: Milestone): Promise<VerifyResult> {
  const config = JSON.parse(milestone.verifyConfig)

  switch (config.testType) {
    case 'vocab_quiz': {
      // 从已标记掌握的词中随机抽取 config.sampleSize 个
      // 生成选择题测试，返回测试 ID
      // 用户完成后回调更新
      const testId = await createVocabQuiz(config.sampleSize)
      return { passed: false, detail: `测试已生成，ID: ${testId}` }
    }
    case 'reading_comprehension': {
      const testId = await createReadingTest(config.level)
      return { passed: false, detail: `测试已生成，ID: ${testId}` }
    }
  }
}

// 证据提交 — 记录证据，标记完成
async function verifyEvidence(milestone: Milestone, evidenceUrl: string, note: string): Promise<VerifyResult> {
  // 证据提交即通过（可信度标注为"证据提交"）
  return { passed: true, detail: note }
}

// 自评声明 — 用户确认即通过
async function verifySelfDeclare(milestone: Milestone): Promise<VerifyResult> {
  return { passed: true, detail: '用户自评声明' }
}
```

---

## 五、AI 教练记忆机制

（与 v1 设计相同，改动点：abilityId/abilityTags 改为 skillId/skillTags + categoryTags）

### Prompt 组装流程

```
buildCoachPrompt(context, userMessage):
  1. 加载 coachProfile.content         → L0 (~800 tokens)
  2. 加载 coachProfile.currentFocus     → L1 (~500 tokens)
  3. 按 context.skillTags/categoryTags 查询 coachMemories
     ORDER BY importance DESC, createdAt DESC
     LIMIT 5                            → L2 (~500 tokens)
  4. 拼接 system prompt + L0 + L1 + L2 + 对话上下文
  → 总记忆开销 ≈ 1800 tokens
```

### 对话后处理流程（异步）

```
afterConversation(conversationId):
  1. 保存完整对话到 coachConversations (L3)
  2. 调用 LLM (Haiku) 生成:
     a. 对话摘要 (3-5句) → 存入 coachMemories (L2)
     b. 画像更新建议 → JSON {field, newValue, reason}
  3. 如果有画像更新建议:
     a. 记录变更到 coachProfileChanges
     b. 更新 coachProfile 对应字段
     c. version++
```

### 记忆检索策略

```sql
SELECT * FROM coachMemories
WHERE EXISTS (
  SELECT 1 FROM json_each(skillTags) AS tag
  WHERE tag.value IN (:relevantSkillIds)
) OR EXISTS (
  SELECT 1 FROM json_each(categoryTags) AS tag
  WHERE tag.value IN (:relevantCategoryIds)
)
ORDER BY importance DESC, createdAt DESC
LIMIT 5
```

无明确技能关联时（如周回顾），取最近 5 条 importance >= 3 的记忆。

---

## 六、主动系统实现

### 触发方式

**方式1: 登录触发**

`GET /api/coach/pending` 在用户打开 app 时调用：

```typescript
async function getPendingActions(): CoachNotification[] {
  const now = Date.now()
  const actions = []

  // 1. 已生成的未过期通知
  actions.push(...await getUnreadNotifications(now))

  // 2. 实时检查
  actions.push(...await checkDailyFocus())           // 今日焦点
  actions.push(...await checkStreakWarnings())        // 松懈预警
  actions.push(...await checkStagnation())            // 焦点技能7天零活动
  actions.push(...await checkExpiringStates())        // 当前状态即将过期

  // 3. 通知预算：最多返回1条 high + 2条 medium
  return applyNotificationBudget(dedup(actions))
}
```

**方式2: Cron 定时任务**

```bash
# 每天 08:00 生成每日通知
0 8 * * * curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/run-scheduled?type=daily

# 每周一 09:00 生成周回顾
0 9 * * 1 curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/run-scheduled?type=weekly

# 每月1日 生成月度报告 + 快照
0 9 1 * * curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/run-scheduled?type=monthly
```

### 定时任务处理逻辑

```typescript
async function runScheduled(type: 'daily' | 'weekly' | 'monthly') {
  switch (type) {
    case 'daily':
      await generateDailyFocusNotification()    // 今日焦点里程碑
      await checkHabitReminders()               // 关联习惯提醒
      await checkStreakWarnings()                // 松懈预警
      await autoUpdatePlatformStates()          // 自动更新平台可追踪的当前状态
      break

    case 'weekly':
      await generateWeeklyReview()              // AI 生成周回顾（Haiku）
      break

    case 'monthly':
      await takeSkillSnapshot()                 // 保存雷达快照
      await generateMonthlyReport()             // AI 生成月报
      await markExpiredStates()                 // 标记过期的当前状态
      await checkStagnation()                   // 检测长期停滞的技能
      break
  }
}
```

### 通知预算实现

```typescript
function applyNotificationBudget(notifications: CoachNotification[]): CoachNotification[] {
  // 按优先级排序
  const sorted = notifications.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))

  // 每天最多: 1 high + 2 medium/low
  const high = sorted.filter(n => n.priority === 'high').slice(0, 1)
  const rest = sorted.filter(n => n.priority !== 'high').slice(0, 2)

  return [...high, ...rest]
}
```

---

## 七、前端架构

### 工具注册

```typescript
// tools/ability-profile/index.ts
registerTool({
  id: 'ability-profile',
  name: '能力画像',
  icon: RadarIcon,
  order: 0,  // 排在第一位
  component: () => import('./AbilityProfile.vue'),
  namespaces: ['ability-skills', 'ability-categories', 'ability-stats', 'focus-plans', 'badges', 'coach'],
})
```

### Store

```typescript
// stores/ability.ts
defineStore('ability', () => {
  const categories = ref<AbilityCategory[]>([])
  const skills = ref<Skill[]>([])
  const radarData = ref<RadarPoint[]>([])
  const focusPlans = ref<FocusPlan[]>([])
  const badges = ref<BadgeWithStatus[]>([])
  const pendingNotifications = ref<CoachNotification[]>([])

  // 技能管理
  async function loadSkills() { ... }
  async function createSkill(data) { ... }
  async function deleteSkill(id) { ... }

  // 里程碑
  async function completeMilestone(skillId, milestoneId, evidence?) { ... }
  async function triggerVerification(skillId, milestoneId) { ... }

  // 雷达
  async function loadRadar() { ... }

  // 焦点计划
  async function createFocusPlan(skillId, targetTier, targetDate) { ... }

  // 通知
  async function loadPendingNotifications() { ... }
  async function dismissNotification(id) { ... }
})

// stores/coach.ts
defineStore('coach', () => {
  const profile = ref<CoachProfile | null>(null)
  const currentConversation = ref<ChatMessage[]>([])

  async function chat(message, context) { ... }
  async function loadProfile() { ... }
  async function onboard(userDescription) { ... }  // 快速建档
})
```

### 页面结构

```
/ability-profile                    → AbilityProfile.vue (入口)
  ├── 默认视图: Dashboard
  │   ├── CoachBanner               -- 今日焦点 / 最高优先级通知
  │   ├── RadarChart                -- 7维雷达图，数据充分度标识
  │   ├── FocusPlans                -- 当前焦点计划 (1-3个)，显示下一个里程碑
  │   ├── RecentMilestones          -- 最近完成的里程碑
  │   ├── BadgeShowcase             -- 最近获得的徽章
  │   └── NotificationList          -- 待处理通知
  │
  ├── /ability-profile/skills       → SkillList.vue (技能管理)
  │   ├── 按大类分组的技能列表
  │   ├── 添加技能入口（模板/AI/自定义）
  │   └── 技能筛选（按大类、状态）
  │
  ├── /ability-profile/skill/:id    → SkillDetail.vue (技能详情)
  │   ├── 技能段位进度 (1-5星)
  │   ├── 当前段位里程碑列表（只展示当前段位的，高段位折叠）
  │   ├── 当前状态面板（过期提醒）
  │   ├── 历史成就时间线
  │   └── 关联活动日志
  │
  ├── /ability-profile/badges       → BadgeWall.vue (荣誉墙)
  │   ├── 已获得的徽章展示
  │   └── 未获得的徽章（灰色，展示达成条件）
  │
  ├── /ability-profile/history      → GrowthHistory.vue (成长记录)
  │   ├── 雷达快照对比（月度）
  │   ├── 技能段位变化曲线
  │   └── 活动日志时间线
  │
  └── /ability-profile/coach        → CoachChat.vue (教练对话)
      ├── 对话界面
      ├── 历史对话列表
      └── 画像查看/编辑
```

### 组件清单

```
components/ability/
├── RadarChart.vue              -- 7维雷达图 (SVG)，虚线/实线区分数据充分度
├── SkillCard.vue               -- 技能卡片（段位星级 + 下一里程碑）
├── SkillTierProgress.vue       -- 段位进度（5星 + 当前段位里程碑完成度）
├── MilestoneItem.vue           -- 里程碑条目（验证方式图标 + 完成状态）
├── MilestoneVerifyModal.vue    -- 验证弹窗（证据上传/测试入口/自评确认）
├── CurrentStatePanel.vue       -- 当前状态面板（过期倒计时）
├── FocusPlanCard.vue           -- 焦点计划卡片
├── BadgeCard.vue               -- 徽章卡片（稀有度色彩）
├── BadgeAwardToast.vue         -- 徽章获得动画/提示
├── CoachBanner.vue             -- 今日焦点横幅
├── NotificationItem.vue        -- 通知条目
├── SnapshotCompare.vue         -- 月度雷达快照对比
├── GrowthTimeline.vue          -- 成长时间线
├── AddSkillModal.vue           -- 添加技能弹窗（模板选择/AI生成/自定义）
├── OnboardingChat.vue          -- 初始建档对话 UI
└── CoachChatPanel.vue          -- 教练对话面板
```

---

## 八、种子数据

### `server/database/seeds/ability-categories.ts`

7 个能力大类（系统预置，不可修改）：

```typescript
export const CATEGORY_SEED = [
  { name: '语言能力', description: '母语及外语的听说读写', icon: 'message-circle', sortOrder: 1 },
  { name: '数理逻辑', description: '数学、科学、技术、工程', icon: 'calculator', sortOrder: 2 },
  { name: '身体运动', description: '体能、运动项目、身体素质', icon: 'activity', sortOrder: 3 },
  { name: '艺术创作', description: '音乐、视觉、表演等创作技能', icon: 'palette', sortOrder: 4 },
  { name: '专业技能', description: '职业相关的可验证专业能力', icon: 'briefcase', sortOrder: 5 },
  { name: '生活实践', description: '日常生活中的实用技能', icon: 'wrench', sortOrder: 6 },
  { name: '自我管理', description: '通过行为数据可追踪的自律与习惯', icon: 'compass', sortOrder: 7 },
]
```

### `server/database/seeds/skill-templates.ts`

官方技能模板（预置 20-30 个常见技能，每个含完整里程碑体系）：

```typescript
export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    id: 'french',
    name: '法语',
    categoryKey: '语言能力',
    description: '法语听说读写综合能力',
    milestones: [
      // 入门 (tier 1)
      { tier: 1, title: '掌握 500 词', type: 'quantity', verify: 'platform_auto',
        config: { source: 'vocab', metric: 'mastered_count', threshold: 500 } },
      { tier: 1, title: '词汇抽查正确率 > 80%', type: 'quality', verify: 'platform_test',
        config: { testType: 'vocab_quiz', sampleSize: 30, passRate: 0.8 } },
      { tier: 1, title: '完成基础语法学习模块', type: 'achievement', verify: 'platform_auto',
        config: { source: 'skill_learning', skillId: 'french-grammar', metric: 'completed', threshold: 1 } },
      // 基础 (tier 2)
      { tier: 2, title: '掌握 2000 词', type: 'quantity', verify: 'platform_auto',
        config: { source: 'vocab', metric: 'mastered_count', threshold: 2000 } },
      { tier: 2, title: 'SRS 复习正确率 > 75%', type: 'quality', verify: 'platform_auto',
        config: { source: 'vocab', metric: 'srs_accuracy', threshold: 0.75 } },
      { tier: 2, title: '通过中级阅读理解测试', type: 'quality', verify: 'platform_test',
        config: { testType: 'reading_comprehension', level: 'intermediate' } },
      // 胜任 (tier 3)
      { tier: 3, title: '掌握 5000 词', type: 'quantity', verify: 'platform_auto',
        config: { source: 'vocab', metric: 'mastered_count', threshold: 5000 } },
      { tier: 3, title: '精读 10 篇法语长文', type: 'quantity', verify: 'platform_auto',
        config: { source: 'article', metric: 'french_articles_read', threshold: 10 } },
      { tier: 3, title: '通过 DELF B1 或同等认证', type: 'achievement', verify: 'evidence',
        config: { evidenceType: 'certificate', description: '上传 DELF B1 成绩单或同等证明' } },
      // 精通 (tier 4)
      { tier: 4, title: '掌握 10000 词', type: 'quantity', verify: 'platform_auto',
        config: { source: 'vocab', metric: 'mastered_count', threshold: 10000 } },
      { tier: 4, title: '读完 5 本法语原著', type: 'quantity', verify: 'evidence',
        config: { evidenceType: 'screenshot', description: '提交阅读记录或书评' } },
      { tier: 4, title: '通过 DELF B2 或同等认证', type: 'achievement', verify: 'evidence',
        config: { evidenceType: 'certificate', description: '上传 DELF B2 成绩单' } },
      // 卓越 (tier 5)
      { tier: 5, title: '通过 DALF C1 或同等认证', type: 'achievement', verify: 'evidence',
        config: { evidenceType: 'certificate', description: '上传 DALF C1 成绩单' } },
      { tier: 5, title: '能用法语进行专业写作或演讲', type: 'achievement', verify: 'evidence',
        config: { evidenceType: 'link', description: '提交法语论文、演讲视频等' } },
    ],
    defaultStates: [
      { key: 'vocab_count', label: '词汇量', source: 'platform_auto', expiresAfterDays: 0 },
      { key: 'srs_accuracy', label: 'SRS正确率', source: 'platform_auto', expiresAfterDays: 0 },
      { key: 'certification', label: '最高认证', source: 'user_confirmed', expiresAfterDays: 0 },
    ]
  },
  {
    id: 'running',
    name: '跑步',
    categoryKey: '身体运动',
    description: '跑步耐力、速度与持续性',
    milestones: [
      { tier: 1, title: '单次完成 3 公里', type: 'achievement', verify: 'self_declare',
        config: { prompt: '确认你能单次不间断跑完 3 公里' } },
      { tier: 1, title: '连续 4 周每周跑步至少 1 次', type: 'consistency', verify: 'platform_auto',
        config: { source: 'habit', metric: 'streak_weeks', threshold: 4 } },
      { tier: 2, title: '单次完成 5 公里', type: 'achievement', verify: 'evidence',
        config: { evidenceType: 'screenshot', description: '提交运动app截图' } },
      { tier: 2, title: '5公里配速 < 7分钟/公里', type: 'quality', verify: 'evidence',
        config: { evidenceType: 'screenshot', description: '提交配速截图' } },
      { tier: 2, title: '连续 12 周每周跑步', type: 'consistency', verify: 'platform_auto',
        config: { source: 'habit', metric: 'streak_weeks', threshold: 12 } },
      { tier: 3, title: '单次完成 10 公里', type: 'achievement', verify: 'evidence',
        config: { evidenceType: 'screenshot', description: '提交运动记录' } },
      { tier: 3, title: '连续 6 个月每周跑步', type: 'consistency', verify: 'platform_auto',
        config: { source: 'habit', metric: 'streak_weeks', threshold: 26 } },
      { tier: 3, title: '累计跑量 500 公里', type: 'quantity', verify: 'evidence',
        config: { evidenceType: 'screenshot', description: '提交累计跑量截图' } },
      { tier: 4, title: '完成半马 21 公里', type: 'achievement', verify: 'evidence',
        config: { evidenceType: 'certificate', description: '提交完赛证书或运动记录' } },
      { tier: 4, title: '5公里配速 < 5分30秒/公里', type: 'quality', verify: 'evidence',
        config: { evidenceType: 'screenshot', description: '提交配速截图' } },
      { tier: 5, title: '完成全马 42 公里', type: 'achievement', verify: 'evidence',
        config: { evidenceType: 'certificate', description: '提交完赛证书' } },
      { tier: 5, title: '半马成绩 < 1小时50分', type: 'quality', verify: 'evidence',
        config: { evidenceType: 'certificate', description: '提交完赛成绩' } },
    ],
    defaultStates: [
      { key: 'single_run_km', label: '单次跑步能力(km)', source: 'user_confirmed', expiresAfterDays: 90 },
      { key: 'weekly_frequency', label: '每周跑步次数', source: 'platform_auto', expiresAfterDays: 0 },
      { key: 'pace_per_km', label: '5公里配速', source: 'user_confirmed', expiresAfterDays: 90 },
    ]
  },
  // ... 更多模板：编程、吉他、游泳、绘画、投资、烹饪等
]
```

### `server/database/seeds/badges.ts`

```typescript
export const BADGE_SEED = [
  // 跨技能通用
  { key: 'first_milestone', name: '第一步', description: '完成第一个里程碑', rarity: 'common' },
  { key: 'first_tier', name: '入门者', description: '任意技能达到入门段位', rarity: 'common' },
  { key: 'triple_focus', name: '三线作战', description: '同时拥有3个焦点计划', rarity: 'common' },
  { key: 'polymath', name: '博学者', description: '在5个以上大类中各有至少1个技能达到基础段位', rarity: 'rare' },
  { key: 'deep_mastery', name: '精深者', description: '任意技能达到卓越段位', rarity: 'legendary' },

  // 自我管理
  { key: 'streak_30', name: '30天坚持', description: '任意习惯连续打卡30天', rarity: 'common' },
  { key: 'streak_100', name: '百日不辍', description: '任意习惯连续打卡100天', rarity: 'rare' },
  { key: 'streak_365', name: '年度坚持者', description: '任意习惯连续打卡365天', rarity: 'epic' },
  { key: 'goal_crusher', name: '目标粉碎机', description: '年度计划完成率超过80%', rarity: 'rare' },

  // 语言
  { key: 'vocab_1k', name: '千词斩', description: '任意语言词汇量突破1000', rarity: 'common' },
  { key: 'vocab_10k', name: '万词王', description: '任意语言词汇量突破10000', rarity: 'epic' },

  // 运动
  { key: 'marathon', name: '全马完赛者', description: '完成42公里马拉松', rarity: 'epic' },
  { key: 'half_marathon', name: '半马完赛者', description: '完成21公里半马', rarity: 'rare' },

  // 学习
  { key: 'lifelong_learner', name: '终身学习者', description: '同时在学3个以上技能', rarity: 'common' },
  { key: 'skill_complete', name: '知识工匠', description: '某技能学习模块全部知识点达到practiced', rarity: 'rare' },
]
```

---

## 九、AI Prompt 模板

### 快速建档对话（Onboarding）

```
System: 你是一个个人能力教练，正在帮助新用户快速建立技能档案。

目标：通过简短对话了解用户已有的技能和大致水平，生成初始技能列表。

规则：
- 用轻松的对话方式，不要像问卷
- 先问用户现在在做什么工作/学习，有什么爱好
- 根据回答，追问 2-3 个关键技能的水平（用具体场景判断段位）
- 最后生成结构化的技能列表

输出格式（在对话结束时）：
```json
{
  "skills": [
    {
      "name": "法语",
      "categoryKey": "语言能力",
      "templateId": "french",         // 匹配官方模板则填，否则 null
      "estimatedTier": 2,             // 根据对话估算的段位
      "states": [                     // 当前状态
        { "key": "vocab_count", "value": "2000", "label": "词汇量" }
      ],
      "preCompletedMilestones": [0, 1, 2, 3, 4]  // 预标记完成的里程碑索引
    }
  ]
}
```
```

### 里程碑体系生成

```
System: 你是一个技能学习专家。为以下技能生成里程碑体系。

要求：
- 分5个段位（入门/基础/胜任/精通/卓越），每段位 2-4 个里程碑
- 每段位必须包含至少一个 quality 类型里程碑（不能全是数量堆积）
- 里程碑必须具体、可验证，用数字或明确标准
- 参考同类技能的常见学习路径和认证体系
- 验证方式要务实：能用平台数据的用 platform_auto，其次用 evidence，最后才用 self_declare
- 返回 JSON 格式

参考官方模板的难度锚点：
- 入门 ≈ "完全初学者经过1-3个月练习可达到"
- 基础 ≈ "坚持半年到一年的业余爱好者水平"
- 胜任 ≈ "认真训练2-3年的中级水平"
- 精通 ≈ "专业级或多年深入实践"
- 卓越 ≈ "顶尖或有公认成就"

User: 技能名称：{{skill.name}}
技能描述：{{skill.description}}
所属大类：{{category.name}}
```

### 教练对话 System Prompt

```
你是用户的个人能力教练。

## 你的原则
- 严格、诚实、以证据说话
- 不恭维、不说空话、不回避问题
- 每次回复必须有具体、可执行的建议
- 关注质量而非数量——用户在"刷数据"时直接指出
- 不可量化的方面（情绪、社交等）可以讨论但不赋予分数

## 用户画像
{{coachProfile.content}}

## 当前提升焦点
{{coachProfile.currentFocus}}

## 相关历史记忆
{{relevantMemories}}

## 当前对话场景
{{context}}
```

### 画像更新 Prompt（Haiku 异步处理）

```
System: 分析以下教练对话，提取需要更新到用户画像中的信息。

当前画像：
{{coachProfile.content}}

当前焦点：
{{coachProfile.currentFocus}}

对话内容：
{{conversation}}

请返回 JSON:
{
  "summary": "3-5句话的对话摘要",
  "skillTags": [相关技能ID],
  "categoryTags": [相关大类ID],
  "importance": 1-5,
  "profileUpdates": [
    {"field": "content|currentFocus", "action": "append|replace|remove", "section": "哪个部分", "newValue": "新内容", "reason": "为什么更新"}
  ]
}
```

### 提升策略生成

```
System: 你是一个个人能力教练。为用户的焦点技能生成提升策略。

要求：
- 基于当前段位和目标段位的差距
- 列出具体的、可执行的行动（不要空话）
- 建议关联到平台已有模块（习惯打卡、年度计划、技能学习）
- 设定合理的时间节奏
- 如果目标不合理（如3个月从入门到精通），直接指出

User:
技能：{{skill.name}}
当前段位：{{currentTier}} ({{TIER_NAMES[currentTier]}})
目标段位：{{targetTier}} ({{TIER_NAMES[targetTier]}})
截止日期：{{targetDate}}
当前未完成里程碑：
{{pendingMilestones}}

用户画像摘要：
{{coachProfile.content}}
```

---

## 十、"自我管理"大类的自动数据源

"自我管理"是唯一一个完全由平台行为数据驱动的大类。不需要用户手动添加技能，系统自动从各模块聚合：

### `server/lib/ability/self-management.ts`

```typescript
// 自我管理下的自动技能
const SELF_MANAGEMENT_SKILLS = [
  {
    name: '习惯坚持度',
    milestones: [
      { tier: 1, title: '创建第一个习惯并坚持7天', verify: 'platform_auto',
        config: { source: 'habit', metric: 'any_streak_days', threshold: 7 } },
      { tier: 2, title: '同时维持2个习惯各30天', verify: 'platform_auto',
        config: { source: 'habit', metric: 'concurrent_habits_30d', threshold: 2 } },
      { tier: 3, title: '任意习惯连续100天', verify: 'platform_auto',
        config: { source: 'habit', metric: 'max_streak_days', threshold: 100 } },
      { tier: 4, title: '同时维持3个习惯各90天', verify: 'platform_auto',
        config: { source: 'habit', metric: 'concurrent_habits_90d', threshold: 3 } },
      { tier: 5, title: '任意习惯连续365天', verify: 'platform_auto',
        config: { source: 'habit', metric: 'max_streak_days', threshold: 365 } },
    ]
  },
  {
    name: '目标执行力',
    milestones: [
      { tier: 1, title: '设定第一个年度目标', verify: 'platform_auto',
        config: { source: 'planner', metric: 'goal_count', threshold: 1 } },
      { tier: 2, title: '完成5个检查项', verify: 'platform_auto',
        config: { source: 'planner', metric: 'completed_checkitems', threshold: 5 } },
      { tier: 3, title: '年度计划完成率 > 50%', verify: 'platform_auto',
        config: { source: 'planner', metric: 'completion_rate', threshold: 0.5 } },
      { tier: 4, title: '年度计划完成率 > 80%', verify: 'platform_auto',
        config: { source: 'planner', metric: 'completion_rate', threshold: 0.8 } },
      { tier: 5, title: '连续2年完成率 > 80%', verify: 'platform_auto',
        config: { source: 'planner', metric: 'consecutive_years_80pct', threshold: 2 } },
    ]
  },
  {
    name: '学习持续性',
    milestones: [
      { tier: 1, title: '在技能学习中完成10个知识点', verify: 'platform_auto',
        config: { source: 'skill_learning', metric: 'total_understood', threshold: 10 } },
      { tier: 2, title: '连续4周每周有学习活动', verify: 'platform_auto',
        config: { source: 'skill_learning', metric: 'active_weeks_streak', threshold: 4 } },
      { tier: 3, title: '连续12周每周有学习活动', verify: 'platform_auto',
        config: { source: 'skill_learning', metric: 'active_weeks_streak', threshold: 12 } },
      { tier: 4, title: '完成一个技能学习模块全部知识点practiced', verify: 'platform_auto',
        config: { source: 'skill_learning', metric: 'any_skill_all_practiced', threshold: 1 } },
      { tier: 5, title: '3个技能学习模块全部practiced', verify: 'platform_auto',
        config: { source: 'skill_learning', metric: 'skills_all_practiced', threshold: 3 } },
    ]
  }
]
```

这些技能在用户首次使用系统时自动创建，不需要手动添加。

---

## 十一、分阶段实施计划

### Phase 1: 基础框架（技能 + 里程碑 + 雷达图）

**数据库**
- [x] `server/database/schemas/ability.ts` — abilityCategories, skills, milestones, milestoneCompletions, skillCurrentState, skillSnapshots, activityLogs
- [x] 生成 migration，运行
- [x] 种子数据：7大类 + 官方技能模板（至少5个：法语、跑步、编程、吉他、烹饪）

**API**
- [x] `GET /api/ability-categories` — 7 大类
- [x] `CRUD /api/ability-skills` — 技能管理
- [x] `GET /api/skill-templates` + `GET /api/skill-templates/:id` — 官方模板
- [x] `POST /api/ability-skills` — 创建技能（从模板创建时自动生成里程碑）
- [x] `CRUD /api/ability-skills/:skillId/milestones` — 里程碑管理
- [x] `POST /api/ability-skills/:skillId/milestones/:id/complete` — 完成里程碑
- [x] 段位解锁自动判定
- [x] `GET /api/ability-stats/radar` — 雷达图数据
- [x] `GET/PUT /api/ability-skills/:skillId/states` — 当前状态

**前端**
- [x] 工具注册：`tools/ability-profile/`
- [x] Store：`stores/ability.ts`
- [x] Dashboard：雷达图 + 技能列表
- [x] 添加技能流程（从模板/自定义）
- [x] 技能详情页：段位进度 + 里程碑列表 + 当前状态
- [x] 里程碑完成交互（验证方式弹窗）

### Phase 2: AI 教练 + 焦点计划 + 徽章

**数据库**
- [x] `server/database/schemas/coach.ts` — coachProfile, coachConversations, coachMemories, coachNotifications, coachProfileChanges
- [x] focusPlans, badges, badgeAwards 表
- [x] 生成 migration

**API**
- [x] `POST /api/ability-skills/onboard` — AI 快速建档
- [x] `POST /api/ability-skills/:skillId/milestones/generate` — AI 生成里程碑
- [x] `GET/PUT /api/coach/profile`
- [x] `POST /api/coach/chat` — 带记忆的教练对话
- [ ] 对话后处理：摘要生成 + 画像更新（Haiku）
- [x] `CRUD /api/focus-plans`
- [x] `POST /api/focus-plans/:id/generate-strategy`
- [x] `GET /api/badges` + `GET /api/badges/awarded`
- [x] 徽章自动授予逻辑

**前端**
- [ ] 初始建档对话（OnboardingChat）
- [x] 教练对话页面
- [x] 焦点计划卡片 + 创建/编辑
- [x] 徽章墙 + 获得动画
- [ ] AI 里程碑生成 UI

### Phase 3: 主动系统 + 成长记录 + 平台验证

**后端**
- [x] `GET /api/coach/pending` — 待处理通知（含通知预算）
- [x] `POST /api/coach/run-scheduled` — 定时任务
- [x] 活动日志自动记录（在各模块 API 中 hook）
- [x] 月度快照自动生成
- [x] 当前状态自动更新 + 过期检测
- [x] 停滞检测逻辑
- [x] 松懈预警逻辑
- [ ] `POST /api/ability-skills/:skillId/milestones/:id/verify` — 平台验证（词汇抽查等）
- [x] "自我管理"自动技能创建 + 自动判定
- [x] Cron 配置

**前端**
- [ ] CoachBanner（今日焦点横幅）
- [ ] 通知列表 + 交互 + 预算展示
- [ ] 成长曲线图（快照对比）
- [ ] 成长时间线
- [ ] 周回顾 / 月报展示页
- [ ] 侧边栏通知徽标
- [ ] 平台验证测试 UI（词汇抽查界面等）
