# FluxCore 项目规划

> 本文记录产品方向与交付进度。当前实现事实以代码、数据库和 Git 历史为准；本文用于解释目标与阶段边界，不替代运行时事实。

## 项目定位

FluxCore 是面向个人开发者和多项目并发开发者的 **Git 原生研发状态记录系统**。它把开发者自然产生的 commit、分支、push 结果和显式开发意图转成可查询的项目状态、活动记录与恢复上下文。

FluxCore 不替代 Jira、Linear、Notion 或 CI 平台，也不把 README 当作项目状态数据库。核心价值是让代码流形成可信的项目事实，再在其上提供语义关联与下一步建议。

## 产品原则

- **Local-first**：v0.1 只保证本机单用户使用，默认 SQLite 和本机 Bearer token。
- **Fact-first**：commit 是最准确的开发事实；push、分支和后续远端事件分别记录来源与确认级别。
- **Explicit semantics**：commit message 和分支名只提供低置信度 Task 信号，不自动创建或推进 Task。
- **Optional intent**：Intent Snapshot 可选，不应成为新的手工填报负担。
- **Derived views**：Workstream 使用多维投影，不用一个互斥枚举压缩活动、发布和风险状态。
- **Machine metadata**：后续使用经过 schema 校验的 `fluxcore.yaml` 承载显式项目元数据；README 只作为低可信观察信号。

## 技术栈

| 层级 | 技术选型 | 当前职责 |
| :--- | :--- | :--- |
| CLI | Go + Cobra | 本地初始化、项目绑定、状态检查；事件采集后续实现 |
| 后端 | Go + Gin | REST API、认证、领域持久化 |
| ORM | GORM | SQLite/PostgreSQL 数据访问 |
| 数据库 | SQLite / PostgreSQL | v0.1 默认 SQLite，保留 PostgreSQL 兼容 |
| 前端 | React 19 + Vite 6 + TypeScript | 本地 Web 控制台 |
| 样式 | Tailwind CSS + 项目样式层 | 构建克制、可扫描的工作台界面 |
| 实时分发 | Redis + WebSocket | 后续阶段引入，不是 v0.1 本地闭环前置条件 |

## 当前进度

### 阶段一：基础设施与本地绑定

目标：打通 CLI、后端和 Web 的本地基础链路。

**后端**

- [x] 初始化 Go 模块和 Gin 服务
- [x] SQLite/PostgreSQL 动态配置与 GORM 连接
- [x] `Project`、`Repository`、`User`、`Config` 基础模型
- [x] 项目与仓库创建、查询 API
- [x] 健康检查和本地单用户 token 认证
- [x] 项目列表聚合 `repository_count`，避免 Web N+1 请求

**CLI**

- [x] `fluxcore init`
- [x] `fluxcore link`
- [x] `fluxcore status`
- [ ] Git 事件采集与本地 outbox（阶段二）

**Web**

- [x] React、Vite、TypeScript 和 Tailwind 工程骨架
- [x] 运行时 token 接入，token 仅保存于 `sessionStorage`
- [x] 项目列表、仓库数量、加载/空/错误状态
- [x] 创建项目弹窗
- [x] 阶段一真实工作流验收：`init → link → status → Web 展示`

### 阶段二：Git 事实采集与可靠投递

目标：先可靠记录事实，再建立语义关联。

**事实与同步**

- [ ] `Event` 事实表和幂等键
- [ ] commit 采集：`post-commit` hook 只触发 CLI，不阻塞 Git
- [ ] 本地 outbox：`pending / sent / accepted / failed`
- [ ] 服务不可用时持久化待投递事件并自动补发
- [ ] push 结果采集方案：优先评估 `fluxcore push` 包装命令；标准 Git 没有客户端 `post-push` hook，`pre-push` 不能证明 push 成功
- [ ] 活动查询 API 与 Web 项目详情时间线

**Task 语义**

- [ ] 显式创建 Task 或确认 Task 关联
- [ ] commit message、分支名仅生成待确认的关联信号
- [ ] 不从低置信度文本自动创建 Task
- [ ] 不因 commit 或 push 自动推进 Task 状态

### 阶段三：元数据与开发流投影

目标：在可信事实层上形成可解释的状态视图。

- [ ] 定义并校验 `fluxcore.yaml` schema
- [ ] README 变更仅作为观察事件，不直接覆盖 Project 状态
- [ ] 建立 Workstream 多维投影：activity、publication、risk、suggested_action
- [ ] Web 项目详情与 Workstream 视图
- [ ] 按本地需求评估 WebSocket；Redis 仅在需要跨进程分发时引入

### 阶段四：上下文恢复与远端确认

- [ ] `resume` 恢复动作：展示上次意图、最后事实和建议下一步
- [ ] 是否提供 CLI `fluxcore resume` 在 Web 工作流稳定后决定
- [ ] GitHub/GitLab/Gitea 远端事件适配
- [ ] push、merge、CI 的远端确认状态
- [ ] 搜索、筛选和多项目聚合

`switch` 不再作为产品核心概念。切换目录只是实现手段，真正的用户价值是恢复上下文，因此统一使用 `resume` 语义。

### 阶段五：可选智能能力

- [ ] 可选 Intent Snapshot
- [ ] 基于事实与显式意图的 AI 摘要
- [ ] 插件系统
- [ ] 部署与通知集成

AI 只负责总结、解释和建议，不写入底层事实真值。

## 下一步

1. 完成阶段一真实联调和 Web 视觉验收。
2. 合并当前 Web 功能分支到 `develop`。
3. 设计 Event、幂等键和本地 outbox 契约。
4. 单独决策 push 成功观测方式，再开始 Git 事件实现。

所有功能分支合入 `develop`；`main` 只接收经过阶段验收的 `develop`。
