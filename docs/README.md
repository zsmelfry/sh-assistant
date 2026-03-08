# 文档目录

## 命名规范

- **当前版本**: 顶层目录，UPPER-CASE 英文文件名，无版本后缀（始终代表最新版本）
- **历史版本**: `archive/v{N}/` 目录，文件名带版本号（如 `PRD-v1.1.md`）
- **新增文档**: 按类型命名，使用 UPPER-CASE + 短横线分隔（如 `API-DESIGN.md`）

## 当前文档

| 文件 | 说明 |
|------|------|
| [PRODUCT.md](PRODUCT.md) | **产品功能书与使用手册** — 全部模块介绍 + 使用指南 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 技术架构文档 v2.0 |
| [LLM-ARCHITECTURE.md](LLM-ARCHITECTURE.md) | LLM 集成架构 v1.0 |
| [DECISIONS.md](DECISIONS.md) | 技术决策记录 (ADR) |
| [TEAM.md](TEAM.md) | 团队结构与分工 |
| [e2e-testing-guide.md](e2e-testing-guide.md) | Playwright E2E 测试指南 |

## 归档文档

### v3 规划文档（已实现）

| 文件 | 说明 |
|------|------|
| [archive/v3-planning/PRD-v3.0-xiaoshuang-assistant.md](archive/v3-planning/PRD-v3.0-xiaoshuang-assistant.md) | v3.0 PRD — 小爽助手全局 AI 教练 |
| [archive/v3-planning/CHANGELOG-v3.0.md](archive/v3-planning/CHANGELOG-v3.0.md) | v3.0 改动说明书（实现细节） |
| [archive/v3-planning/product-spec.md](archive/v3-planning/product-spec.md) | 能力画像系统产品功能书 |
| [archive/v3-planning/system-design.md](archive/v3-planning/system-design.md) | 能力画像系统设计书 |
| [archive/v3-planning/user-guide.md](archive/v3-planning/user-guide.md) | 能力画像系统使用手册 |

### v2 — Nuxt 3 + SQLite 全栈重构（已完成）

| 文件 | 说明 |
|------|------|
| [archive/v2/PRD-v2.0.md](archive/v2/PRD-v2.0.md) | v2.0 PRD（Nuxt 3 迁移 + SQLite + 图表） |
| [archive/v2/E2E-TEST-PLAN.md](archive/v2/E2E-TEST-PLAN.md) | 习惯打卡 E2E 测试计划 |
| [archive/v2/PLUGIN-ARCHITECTURE-ANALYSIS.md](archive/v2/PLUGIN-ARCHITECTURE-ANALYSIS.md) | 插件化架构深度分析 |
| [archive/v2/annual-planner-architecture.md](archive/v2/annual-planner-architecture.md) | 年度规划器技术架构 |
| [archive/v2/annual-planner-requirements.md](archive/v2/annual-planner-requirements.md) | 年度规划器功能需求 |
| [archive/v2/annual-planner-spec.md](archive/v2/annual-planner-spec.md) | 年度规划器产品规格 |
| [archive/v2/article-reader-prd.md](archive/v2/article-reader-prd.md) | 文章阅读器 PRD |
| [archive/v2/article-reader-p0-spec.md](archive/v2/article-reader-p0-spec.md) | 文章阅读器 P0 MVP 规格 |
| [archive/v2/mobile-auth-requirements.md](archive/v2/mobile-auth-requirements.md) | LAN 认证 + 移动适配需求 |
| [archive/v2/mobile-auth-architecture.md](archive/v2/mobile-auth-architecture.md) | LAN 认证 + 移动适配架构 |
| [archive/v2/startup-map-prd.md](archive/v2/startup-map-prd.md) | 创业地图 PRD |
| [archive/v2/startup-map-spec.md](archive/v2/startup-map-spec.md) | 创业地图功能规格 |
| [archive/v2/startup-map-architecture.md](archive/v2/startup-map-architecture.md) | 创业地图技术架构 |
| [archive/v2/startup-map-guide.md](archive/v2/startup-map-guide.md) | 创业地图使用指南 |
| [archive/v2/skill-learning-core-prd.md](archive/v2/skill-learning-core-prd.md) | 技能学习核心层 PRD |
| [archive/v2/skill-learning-core-rfc.md](archive/v2/skill-learning-core-rfc.md) | 技能学习核心层 RFC |
| [archive/v2/skill-learning-prd.md](archive/v2/skill-learning-prd.md) | UI 驱动技能系统 PRD |
| [archive/v2/skill-learning-architecture.md](archive/v2/skill-learning-architecture.md) | 技能学习架构分析 |
| [archive/v2/compiled-launching-wolf.md](archive/v2/compiled-launching-wolf.md) | UI 驱动技能系统设计 |
| [archive/v2/project-tracker-prd.md](archive/v2/project-tracker-prd.md) | 事项追踪器 PRD |

### v1 — React + IndexedDB 前端 SPA（已废弃）

| 文件 | 说明 |
|------|------|
| [archive/v1/PRD-v1.1.md](archive/v1/PRD-v1.1.md) | v1.1 PRD (React + IndexedDB) |
| [archive/v1/ARCHITECTURE-v1.md](archive/v1/ARCHITECTURE-v1.md) | v1.0 架构 (React + Vite) |

## 版本归档策略

当发布新大版本时：
1. 将当前顶层文档复制到 `archive/v{N}/`，文件名加版本号
2. 在顶层更新文档内容为新版本
3. 更新本 README 的归档列表
