# 文档目录

## 命名规范

- **当前版本**: 顶层目录，UPPER-CASE 英文文件名，无版本后缀（始终代表最新版本）
- **历史版本**: `archive/v{N}/` 目录，文件名带版本号（如 `PRD-v1.1.md`）
- **新增文档**: 按类型命名，使用 UPPER-CASE + 短横线分隔（如 `API-DESIGN.md`）

## 当前文档

| 文件 | 说明 |
|------|------|
| [PRD.md](PRD.md) | 产品需求文档 v2.0 (Nuxt 3 + SQLite) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 技术架构文档 v2.0 |
| [DECISIONS.md](DECISIONS.md) | 技术决策记录 (ADR) |
| [E2E-TEST-PLAN.md](E2E-TEST-PLAN.md) | E2E 测试计划 |
| [TEAM.md](TEAM.md) | 团队结构与分工 |
| [PLUGIN-ARCHITECTURE-ANALYSIS.md](PLUGIN-ARCHITECTURE-ANALYSIS.md) | 插件化架构深度分析 |

## 归档文档

| 文件 | 说明 |
|------|------|
| [archive/v1/PRD-v1.1.md](archive/v1/PRD-v1.1.md) | v1.1 PRD (React + IndexedDB) |
| [archive/v1/ARCHITECTURE-v1.md](archive/v1/ARCHITECTURE-v1.md) | v1.0 架构 (React + Vite) |

## 版本归档策略

当发布新大版本时：
1. 将当前顶层文档复制到 `archive/v{N}/`，文件名加版本号
2. 在顶层更新文档内容为新版本
3. 更新本 README 的归档列表
