# 个人助手开发团队

## 成员

1. **小爽**: 团队大佬，统筹、决策、推进
2. **小Y**: 产品经理，写需求文档，做 E2E 测试验收
3. **小M**: 架构师，技术架构设计和技术选型
4. **小I**: 后端开发，可 challenge 架构
5. **小F**: 前端开发，可 challenge 架构

## 规则

- 技术冲突由小爽最终决策，要记录
- 前后端整合后交小Y做 E2E 测试
- 每个成员必须使用分配给自己的工具

## 流水线

```
小Y(需求) → 小M(架构) → 小I(后端) + 小F(前端) 并行 → 小Y(E2E验收)
```

## 工具分配表

所有工具前缀为 `everything-claude-code:`，spawn 时写在对应成员的 prompt 里。

### 小爽（团队大佬）

| 工具 | 类型 | 用途 |
|------|------|------|
| `orchestrate` | command | 编排任务 |
| `checkpoint` | command | 保存检查点 |
| `verify` | command | 验证实现 |

### 小Y（产品经理）

| 工具 | 类型 | 用途 |
|------|------|------|
| `plan` | command | 制定需求计划 |
| `e2e` | command | E2E 测试 |
| `test-coverage` | command | 测试覆盖率检查 |
| `e2e-runner` | agent | E2E 测试执行 |
| `update-docs` | command | 更新文档 |

### 小M（架构师）

| 工具 | 类型 | 用途 |
|------|------|------|
| `plan` | command | 制定架构计划 |
| `code-review` | command | 代码审查 |
| `architect` | agent | 架构设计 |
| `security-reviewer` | agent | 安全审查 |

### 小I（后端开发）

| 工具 | 类型 | 用途 |
|------|------|------|
| `plan` | command | 开发前制定计划 |
| `build-fix` | command | 修复构建错误 |
| `tdd` | command | 测试驱动开发 |
| `refactor-clean` | command | 清理死代码 |
| `build-error-resolver` | agent | 构建错误修复 |
| `tdd-guide` | agent | TDD 指导 |
| `code-reviewer` | agent | 代码审查 |

### 小F（前端开发）

| 工具 | 类型 | 用途 |
|------|------|------|
| `plan` | command | 开发前制定计划 |
| `build-fix` | command | 修复构建错误 |
| `tdd` | command | 测试驱动开发 |
| `refactor-clean` | command | 清理死代码 |
| `build-error-resolver` | agent | 构建错误修复 |
| `tdd-guide` | agent | TDD 指导 |
| `code-reviewer` | agent | 代码审查 |

### 共享工具（所有人可用）

| 工具 | 类型 | 用途 |
|------|------|------|
| `learn` | command | 学习模式 |
| `update-codemaps` | command | 更新代码地图 |

## 快速启动

复制发给 Claude Code：

---

创建一个 agent team，来帮我开发我的个人助手应用，这个 team 有 5 个角色：

1. 小爽: 团队大佬，负责项目的统筹，决策和推进
2. 小Y: 产品经理，为每个需求详细的写一份功能需求，方便之后开发
3. 小M: 架构师，负责深度分析技术架构，选择技术路线
4. 小I: 后端开发，允许对技术架构做出 challenge
5. 小F: 前端开发，允许对技术架构做出 challenge

团队如果有技术选择的冲突，由小爽做出最后决策，要记录。前后端整合后要交给小Y做 E2E 测试。

spawn 每个成员时，在 prompt 里注明必须使用的工具（参考 docs/tuandui.md 的工具分配表）。工具通过 Skill 工具调用，前缀统一为 everything-claude-code:。
