# FluxCore v0.1 架构基线

本文定义 FluxCore 当前架构边界。v0.1 面向本机单用户使用，先建立可靠事实链路和可用 Web 工作台，再扩展远端平台与智能能力。

## 架构目标

```text
Git Repository → CLI / Local Outbox → Backend API → Database → Web UI
```

v0.1 不依赖公网回调、Redis、多用户账号体系或远端 Git 平台。外部平台事件后续用于补充 push、merge 和 CI 的远端确认，不覆盖已经记录的本地事实。

## 设计原则

- **Local-first**：默认 SQLite、本机服务和单用户 token。
- **Event-first**：不可变事件记录事实，展示状态从事实派生。
- **Deterministic-first**：规则计算底层状态，AI 只提供摘要、解释和建议。
- **Confidence-aware**：事实、报告、推断和用户确认必须区分，不能混成一个状态。
- **Non-blocking Git**：FluxCore 故障不能阻止 commit 或 push。
- **MVP restraint**：Web 基础工作流优先；CLI 事件扩展在其后推进。

## 四层状态模型

FluxCore 不把“提交了”“推送了”“服务收到了”和“任务完成了”压成一个字段。

```text
事实层      commit、branch、push report
同步层      pending、sent、accepted、failed
投影层      activity、publication、risk、suggested_action
语义层      Task signal、Intent、README observation、AI summary
```

### 事实层

- commit 是本地仓库已发生的确定事实，保留 SHA、branch、message 和 occurred_at。
- branch 是 commit 发生时的上下文，不从命名直接推导任务真值。
- push report 表示某个观察来源报告 push 成功；必须记录来源，不能冒充远端确认。
- v0.1 不实现远端确认，后续由 Git 平台事件补齐。

### 同步层

每个待上报事实进入本地 outbox，并独立维护：

```text
pending → sent → accepted
              ↘ failed → retry
```

- Hook 只采集并写入本地队列，不等待后端业务处理。
- 网络或服务不可用时事件不能丢失。
- 后端以幂等键拒绝重复写入，但重复投递不视为失败。

### 投影层

Workstream 是计算视图，不在 v0.1 建立强实体。状态按多个维度共存：

```text
activity:         active / idle / stale
publication:      local_only / push_pending / pushed / remote_confirmed
risk:             none / blocked / diverged / conflict
suggested_action: none / resume / review / merge
```

`Ready to Resume` 和 `Ready to Merge` 是建议动作，不是与 `Blocked`、`Diverged` 互斥的生命周期状态。

### 语义层

- Task 必须显式创建，或由用户确认与现有 Task 的关联。
- commit message 和分支名只产生低置信度信号，不自动创建 Task，也不自动推进状态。
- Intent Snapshot 可选；缺少 Intent 不影响事实采集。
- README 只产生低可信观察信号，不直接更新 Project 状态。
- AI 输出始终是可重新生成的解释，不是事实来源。

## push 观测边界

标准客户端 Git 没有 `post-push` hook。`pre-push` 发生在远端接受之前，因此不能作为成功证据。

后续实现需要在以下来源中明确选择并记录来源类型：

1. `fluxcore push` 包装命令：执行真实 `git push`，仅在退出码成功后写入 push report。
2. Shell 集成：观察用户原始命令及退出结果，接入成本更高。
3. 远端平台 Webhook：可提供权威远端确认，但不属于本地 v0.1。

在该决策完成前，不实现伪造的 `post-push` hook，也不把 `pre-push` 当成功状态。

## 核心领域模型

### Project

用户关心的产品或研发对象。当前字段包括 `id`、`name`、`description`、`status` 和时间戳。

### Repository

Project 下的 Git 仓库。模型支持一个 Project 对应多个 Repository，当前字段包括本地路径、remote URL 和默认分支。

### Event（阶段二）

不可变事实表，至少包含：

- `id`、`event_type`、`source`
- `project_id`、`repository_id`
- `branch_name`、`commit_sha`
- `payload`、`occurred_at`、`received_at`
- 客户端生成的幂等键

最小事件类型计划为 `project_created`、`repository_linked`、`commit_observed` 和 `push_reported`。

### Task（阶段二后半）

显式语义实体。Task 状态独立于 Git 活动变更，任何自动建议必须保留证据和待确认状态。

### Intent（可选、后续）

用户主动记录的开发意图，可关联分支、Task 和一段事件区间。它用于恢复上下文，不是使用 FluxCore 的强制步骤。

### Machine Metadata（阶段三）

`fluxcore.yaml` 是计划中的显式机器元数据入口，必须有版本化 schema 和校验错误。README 不承担该职责。

## 当前 API 边界

阶段一已经提供：

- `GET /health`
- `POST /api/projects`
- `GET /api/projects`，包含 `repository_count`
- `POST /api/projects/:project_id/repositories`
- `GET /api/projects/:project_id/repositories`

阶段二计划引入：

- `POST /api/events`
- `GET /api/projects/:project_id/events`
- Task 创建、查询和关联确认接口

CLI 和 Web 的正式工作流只调用后端 API，不直接写数据库。Web 不读取 CLI 本地配置；浏览器 token 由用户在运行时输入并保存在 `sessionStorage`。为便于本地视觉验收，Web 另提供隔离的 Demo 账号：该模式完全使用浏览器 `sessionStorage` 中的 mock 项目，不发送 API 请求，也不代表后端事实。

## 模块职责

### CLI

当前负责初始化、绑定和状态检查。阶段二增加事实采集、本地 outbox、重试和明确的 push 观测入口；不负责 Workstream 计算或数据库写入。

### Backend

负责认证、API、领域持久化、事件幂等和确定性投影。它不直接操作用户 Git 仓库，也不从低置信度文本擅自改变任务状态。

### Web

负责项目创建、列表、详情和后续 Workstream 视图。v0.1 通过 Vite 本地代理访问后端，不为本地开发开放宽泛 CORS。

## 数据库与认证

- SQLite 是 v0.1 默认数据库；PostgreSQL 保持模型兼容。
- 当前使用 GORM AutoMigrate，进入多环境部署前再引入显式迁移工具。
- 认证为本地单用户 Bearer token，不实现注册、OAuth、RBAC 或团队空间。

## 明确延后

- Git 远端平台 Webhook
- 远端 push / merge / CI 确认
- 完整 Workstream Radar
- Intent Snapshot 命令与 UI
- Redis 和 WebSocket
- AI 总结、插件、通知与生产部署

这些能力必须建立在阶段一 Web 可用性和阶段二可靠事实投递之上。
