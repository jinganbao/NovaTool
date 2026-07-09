# NovaTool 🛠️

> 程序员常用开发工具箱 —— 一款基于 Tauri v2 构建的跨平台桌面应用，集成了 16 个日常开发工具，无需浏览器即可高效使用。

## ✨ 功能概览

NovaTool 将所有工具分为四大类别，覆盖日常开发中最常见的需求：

### 🔗 网络调试

| 工具 | 说明 |
|------|------|
| **TCP 客户端** | 支持 UTF-8 / HEX 两种模式收发数据，持久化连接池管理，内置 JSON 模板构建器 |
| **TCP 服务器** | 一键启动 TCP 监听服务，实时查看连接/断开/数据日志，支持文本和十六进制视图 |
| **端口检查器** | 列出系统所有监听端口，显示 PID、进程名，支持搜索过滤和**一键结束进程** |

### 📝 文本与格式化

| 工具 | 说明 |
|------|------|
| **JSON 格式化器** | 校验、美化（2空格缩进）、压缩，编辑器内置语法高亮与错误行提示 |
| **XML 格式化器** | XML 解析、层次化缩进格式化、压缩，支持语法高亮 |
| **文本差异比较** | 逐行文本对比，编辑模式（并排编辑）与比较模式（高亮差异），支持同步滚动、交换与复制 |
| **正则测试器** | 完整正则表达式支持（g/i/m/s/u 标志），实时匹配高亮，匹配列表展示位置与长度，支持查找替换 |

### 🔄 编码转换

| 工具 | 说明 |
|------|------|
| **URL 编解码** | 支持 `encodeURIComponent` / `encodeURI` 两种模式，附带使用提示 |
| **时间戳转换** | 实时时钟显示，时间戳 ↔ 日期互转（自动识别秒/毫秒），支持本地时间 / UTC / ISO 8601 / 星期 / 年中天数等多种格式 |
| **Base64 编解码** | 基于 TextEncoder/TextDecoder 正确处理 UTF-8 字符，支持一键交换输入输出 |
| **进制转换** | 二进制、八进制、十进制、十六进制互转，基于 BigInt 支持大数，自动检测输入格式 |
| **哈希计算** | 支持 MD5、SHA-1、SHA-256、SHA-512、SM3 五种算法（通过 WebAssembly 计算），一键切换并行输出 |

### 🎲 生成器

| 工具 | 说明 |
|------|------|
| **密码生成器** | 可配置长度（6-64位）与4种字符集，强度指示器（位熵 + 可视化进度条），排除易混淆字符（0/O/1/l/I），使用 `crypto.getRandomValues` 安全随机 |
| **Cron 表达式工具** | 5字段 cron 解析器，生成人类可读描述，12个常用预设，字段参考指南，向前推算未来执行时间（最多5年） |
| **二维码生成器** | 文本/URL 生成二维码，4级纠错（L/M/Q/H），可调尺寸（128-1024px），自定义前景/背景色，支持**下载 PNG** 和**复制图片** |
| **UUID 生成器** | 支持 UUID v4（随机）、v7（时间排序）、NIL，可选大写/小写/去连字符，支持**批量生成**（1-500个） |

### 🎨 更多特性

- **5 种主题配色**：NovaMsg / NovaDB / NovaFlow / NovaOps / NovaAI
- **暗色 / 亮色模式**：随心切换
- **自动更新**：应用内检测新版本并一键更新
- **配置持久化**：设置和工具数据自动保存在本地

## 🖼️ 截图

<!-- TODO: 添加应用截图 -->

## 🏗️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | **Tauri v2** | Rust 构建的高性能、小体积桌面应用框架 |
| 前端 | **Vue 3.5** + **TypeScript** | Composition API + `<script setup>` |
| UI 组件库 | **Naive UI** | Vue 3 组件库 |
| 代码编辑器 | **CodeMirror 6** | 支持 JSON/XML 语法高亮、行装饰、代码折叠 |
| 图标 | **lucide-vue-next** | 现代 SVG 图标集 |
| 构建工具 | **Vite 6** | 极速开发与生产构建 |
| 包管理 | **pnpm** | 高效的 monorepo 包管理器 |

## 🔧 系统要求

- **Rust** 1.77.2 或更高版本
- **Node.js** 18+ 
- **pnpm** 10+
- **macOS**: Xcode Command Line Tools
- **Linux**: `libwebkit2gtk-4.1-dev`、`libgtk-3-dev` 等系统依赖（详见 [Tauri 文档](https://v2.tauri.app/start/prerequisites/)）
- **Windows**: Microsoft Visual Studio C++ Build Tools、WebView2

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/jinganbao/NovaTool.git
cd NovaTool

# 2. 安装依赖
pnpm install

# 3. 仅启动前端开发服务器（浏览器访问 http://127.0.0.1:1421）
pnpm dev

# 4. 在 Tauri 桌面窗口中启动完整应用
pnpm tauri:dev

# 5. 构建生产版本（安装包输出到 src-tauri/target/release/bundle/）
pnpm tauri:build
```

## 📁 项目结构

```
NovaTool/
├── src/                        # Vue 3 前端源码
│   ├── components/
│   │   ├── editor/             # CodeMirror 编辑器封装
│   │   ├── layout/             # 布局组件（侧边栏、工作区、设置）
│   │   └── tools/              # 16 个工具组件
│   ├── composables/            # 组合式函数（配置、剪贴板、更新）
│   ├── config/                 # 工具定义、主题配置
│   ├── types/                  # TypeScript 类型定义
│   └── utils/                  # 工具函数（哈希、格式化、cron 解析）
├── src-tauri/                  # Tauri / Rust 后端
│   ├── src/
│   │   └── lib.rs              # Tauri 命令（TCP、文本差异、端口管理）
│   ├── Cargo.toml              # Rust 依赖
│   ├── tauri.conf.json         # Tauri 配置
│   └── capabilities/           # Tauri v2 权限声明
├── .github/workflows/          # CI/CD（跨平台构建发布）
├── package.json                # 项目脚本与依赖
├── vite.config.ts              # Vite 构建配置
└── index.html                  # 入口 HTML
```

## 📦 构建与发布

本项目使用 GitHub Actions 自动构建，在推送 `v*` 版本标签时自动触发，生成以下平台的安装包：

- **macOS**: Apple Silicon (aarch64) + Intel (x86_64)
- **Ubuntu 22.04**: x86_64
- **Windows**: x86_64

发布产物包含签名的 Tauri 安装包和自动更新清单文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feat/amazing-feature`
5. 发起 Pull Request

## 📄 许可证

[MIT](LICENSE)

---

**NovaTool** —— 让开发更高效 🚀
