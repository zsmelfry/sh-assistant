# 文档目录

## 命名规范

- **当前版本**: 顶层目录，UPPER-CASE 英文文件名，无版本后缀（始终代表最新版本）
- **历史版本**: `archive/v{N}/` 目录，文件名带版本号（如 `PRD-v1.1.md`）
- **新增文档**: 按类型命名，使用 UPPER-CASE + 短横线分隔（如 `API-DESIGN.md`）

## 当前文档

| 文件 | 说明 |
|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 技术架构文档 v2.0 |
| [LLM-ARCHITECTURE.md](LLM-ARCHITECTURE.md) | LLM 集成架构 v1.0 |
| [DECISIONS.md](DECISIONS.md) | 技术决策记录 (ADR) |
| [TEAM.md](TEAM.md) | 团队结构与分工 |

## 归档文档

### v2 — Nuxt 3 + SQLite 全栈重构（已完成）

| 文件 | 说明 |
|------|------|
| [archive/v2/PRD-v2.0.md](archive/v2/PRD-v2.0.md) | v2.0 PRD（Nuxt 3 迁移 + SQLite + 图表） |
| [archive/v2/E2E-TEST-PLAN.md](archive/v2/E2E-TEST-PLAN.md) | 习惯打卡 E2E 测试计划 |
| [archive/v2/PLUGIN-ARCHITECTURE-ANALYSIS.md](archive/v2/PLUGIN-ARCHITECTURE-ANALYSIS.md) | 插件化架构深度分析 |
| [archive/v2/annual-planner-architecture.md](archive/v2/annual-planner-architecture.md) | 年度规划器技术架构 |
| [archive/v2/annual-planner-requirements.md](archive/v2/annual-planner-requirements.md) | 年度规划器功能需求 |
| [archive/v2/annual-planner-spec.md](archive/v2/annual-planner-spec.md) | 年度规划器产品规格 |
| [archive/v2/article-reader-prd.md](archive/v2/article-reader-prd.md) | 文章阅读器 PRD（P0-P2 全部完成） |
| [archive/v2/article-reader-p0-spec.md](archive/v2/article-reader-p0-spec.md) | 文章阅读器 P0 MVP 规格 |
| [archive/v2/mobile-auth-requirements.md](archive/v2/mobile-auth-requirements.md) | LAN 认证 + 移动适配需求 |
| [archive/v2/mobile-auth-architecture.md](archive/v2/mobile-auth-architecture.md) | LAN 认证 + 移动适配架构 |

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
