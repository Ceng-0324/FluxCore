# FluxCore v0.1 架构基线

> 当前基线以代码和测试为准。Web 当前实现是阶段一验证用工作区，后续会重构；本文件优先描述可靠事实链路。

## 产品切入点

FluxCore 面向同时维护多个项目的个人开发者。它不试图替代 Jira、Linear、Notion 或 CI，而是记录开发者已经自然产生的 Git 事实，让人几天后回到项目时能回答：

- 上次在哪个仓库、哪个分支做了什么？
- 这条事实是否已经同步到 FluxCore？
- 接下来从哪里继续？

## v0.1 可靠事实链路

```text
git commit
  ↓
post-commit hook（不等待网络，不阻止 commit）
  ↓
fluxcore observe commit
  ↓
.fluxcore/outbox/*.json（本地持久化）
  ↓
fluxcore sync
  ↓
POST /api/events
  ↓
Event 表（幂等写入）
  ↓
项目事件查询 / 后续 Web 重构
```

Hook 只触发 CLI。CLI 只读取 Git 和本地绑定配置，并把事件先安全写入本地 outbox；`sync` 才访问后端。服务不可用时，outbox 文件保留，后续可以重试。

当前只实现 `commit_observed`。不从 commit message 或分支名自动创建 Task，也不把 commit 推断成“已完成”。

## 事件模型

`Event` 是不可变事实记录，至少包含：

- `idempotency_key`
- `event_type`、`source`
- `project_id`、`repository_id`
- `branch_name`、`commit_sha`
- `payload`
- `occurred_at`、`received_at`

幂等键由 CLI 按 `commit:<repository_id>:<commit_sha>` 生成。重复投递返回已有事件，不产生重复记录；同一个幂等键携带不同内容时返回冲突。

### 当前 API

- `GET /health`
- `POST /api/projects`
- `GET /api/projects`
- `POST /api/projects/:project_id/repositories`
- `GET /api/projects/:project_id/repositories`
- `POST /api/events`
- `GET /api/projects/:project_id/events`

## 状态边界

FluxCore 区分：

```text
事实：commit 已在本地仓库发生
投递：事件仍在 outbox、已发送或已被服务接收
语义：任务关联、开发意图和下一步建议
```

“本地已记录”不等于“服务已接收”；“服务已接收”也不等于“任务完成”。Web 不应把这些状态压成一个“运行中”徽标。

## Repository 与工作副本

当前 `Repository` 仍同时保存 remote URL 和 local path，适合 v0.1 的单机绑定。后续恢复上下文前，需要把逻辑仓库与本地工作副本区分开，以覆盖多个 clone、worktree、目录移动和不同 remote 表示方式。

本轮不提前引入复杂多机模型，但事件设计保留该演进空间。

## 模块职责

### CLI

负责 `init`、`link`、`status`、`observe commit`、`sync`、本地配置和 outbox。Hook 失败不能反向阻止 Git commit。

### Backend

负责 Bearer token 认证、事件校验、幂等持久化和查询。后端不执行用户 Git 命令，也不从低置信度文本改写任务真值。

### Web

当前 Web 仅用于阶段一基础工作流和 Demo 验收。下一阶段会围绕事件时间线与“回来继续”重新设计，不在旧项目卡片模型上继续堆活动流、WebSocket 或状态徽标。

## 明确延后

- Web 事件时间线和恢复上下文视图
- Task 显式实体与关联确认
- Intent Snapshot
- 远端 push、merge、CI 确认
- Redis、WebSocket 和多用户权限
- AI 摘要、插件、通知和生产部署
