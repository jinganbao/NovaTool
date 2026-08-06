# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 修复

- **进制转换**：修复源进制为二/八/十六进制时输入全部解析失败的问题（前缀拼接错误）
- **正则测试**：正则计算移至 Web Worker，2s 超时可强制中止灾难性回溯；增加 150ms 防抖、1MB 输入上限、5000 条结果上限，修复旧请求超时覆盖新状态与清空后旧结果回写的竞态
- **文本比较**：字符级 diff 从前端 O(n·m) LCS 迁移到 Rust（similar 算法），修复 changed 行配对错位与中文/emoji 高亮偏移错误
- **JSON/XML 格式化**：迁移到 Rust 端执行（serde_json / quick-xml），不再阻塞主线程；XML 修复 CDATA/注释/DOCTYPE 被破坏的问题，压缩路径补上错误处理
- **Cron 工具**：修复 `0 9 * * 7`（7=周日）永远无匹配、计算首分钟被排除的问题
- **二维码生成**：移除 `v-html` 渲染（XSS 风险面），改为 data URL 图片渲染

### 安全

- **端口检查**：`kill_process` 增加 PID 校验，拒绝 0（进程组信号）/1（init）/应用自身/系统进程；SIGTERM 失败后复查进程状态再决定是否 SIGKILL
- **TCP 调试**：短连接响应 16MB 截断（新增截断提示）、长连接池 32 上限、HEX 输入 1MB 上限、服务端单次发送 1MB 上限
- **文本比较**：输入单侧 1MB 上限，防止 O(n²) diff 卡死

### 工程化

- 新增前端测试基座（vitest + happy-dom），覆盖 cron/storage 共 18 个用例；Rust 端 34 个单元测试（diff 标记、JSON/XML 格式化、端口解析、HEX 编解码）
- 新增 ESLint（零错误）、Prettier、rustfmt、Clippy（`-D warnings` 零警告）与对应 scripts
- 新增 PR 门禁 CI（`.github/workflows/ci.yml`）：前端 lint/typecheck/test/build + 后端 fmt/clippy/test
- `scripts/release.sh` 恢复版本控制，修复 Cargo.lock 不同步问题，增加工作区脏检查与真实仓库地址输出
- 新增 LICENSE（MIT）与 CHANGELOG
- 删除零引用的占位组件 PlaceholderTool.vue

## [1.0.6] - 2026-08-05

- 常规维护与体验优化

## [1.0.5] - 2026-08-04

- 常规维护与体验优化

## [1.0.4] - 2026-08-04

- 常规维护与体验优化

## [1.0.3] - 2026-07-09

- 常规维护与体验优化

## [1.0.2] - 2026-07-09

- 常规维护与体验优化

## [1.0.1] - 2026-07-09

- 首个公开发布版本：16 个开发者工具，5 种主题，暗色/亮色模式，自动更新
