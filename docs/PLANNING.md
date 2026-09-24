# FluxCore 项目规划

> 以代码、测试和当前分支为准；本文件只描述已完成事实与下一段可验收工作。Web 旧阶段实现暂不继续堆功能，下一步重构。

## 当前定位

FluxCore 是面向个人开发者和多项目并发场景的 Git 原生研发状态记录系统。第一价值不是做一个更热闹的看板，而是让开发者回到旧项目时能恢复最近的事实和上下文。

## 已完成

### 阶段一：基础绑定与验证工作区

- [x] Go 后端、Gin、GORM、SQLite/PostgreSQL 配置
- [x] Project、Repository、User、Config 基础模型
- [x] 健康检查与本地单用户 Bearer token
- [x] Project / Repository 创建和查询 API
- [x] `fluxcore init`
- [x] `fluxcore link`
- [x] `fluxcore status`
- [x] Web 项目列表、创建和隔离 Demo 工作区

Web 阶段一代码用于验证基础链路，后续会围绕事件时间线和恢复上下文重构，不继续在旧卡片模型上添加活动流、WebSocket 或状态徽标。

## 当前进行：阶段二第一纵切

目标是先证明“真实 Git 事实不会丢，而且能被服务可靠接收”，暂不引入 Task 自动判断。

### commit 事实链路

- [x] `Event` 不可变事实模型
- [x] `commit_observed` 事件类型
- [x] `POST /api/events`
- [x] `GET /api/projects/:project_id/events`
- [x] 幂等键和重复投递去重
- [x] 相同幂等键不同内容返回冲突
- [x] `fluxcore init` 安装非阻塞 `post-commit` hook
- [x] `fluxcore observe commit` 写入本地 `.fluxcore/outbox/`
- [x] `fluxcore sync` 成功后删除 outbox，失败时保留待重试事件
- [x] CLI、API、数据库测试
- [x] 真实 commit → hook → outbox → sync → API 端到端验证

### 明确未做

- [ ] 标准 Git push 成功观测（标准 Git 没有 `post-push` hook）
- [ ] Task 实体和任务关联确认
- [ ] commit message / 分支名语义解析
- [ ] Web 事件时间线
- [ ] Repository 与本地工作副本拆分

## 下一段工作顺序

1. 补齐事件投递的失败、重启、重复和权限边界测试。
2. 设计可读取事实的最小 Web 重构：先做事件时间线，再做“回来继续”。
3. 明确逻辑 Repository 与本地工作副本模型，覆盖 clone、worktree 和目录移动。
4. 单独决策 push 成功观测方案，再实现 push report。
5. 在事实稳定后，再讨论 Task、Intent、Workstream 和远端确认。

## 暂不推进

- Redis、WebSocket 和实时大屏
- AI 摘要和自动任务状态
- GitHub/GitLab/Gitea 远端 Webhook
- 多用户、OAuth、RBAC 和团队空间
- 插件、通知和生产部署

这些方向保留为后续能力，但都不应绕过可靠事实链路和可解释的 Web 体验。
