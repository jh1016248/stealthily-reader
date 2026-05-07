# Stealthily Reader

一款极简的桌面电子书阅读器，专注于沉浸式、无干扰的阅读体验。

![logo](logo2.png)

## 特性

- **隐身模式** — 透明无边框窗口，控件仅在鼠标悬停时显示，阅读时完全隐身
- **EPUB & TXT 支持** — 解析 EPUB 电子书（含卷→章嵌套目录），智能识别 TXT 文件章节
- **阅读设置** — 字号、文字颜色、背景颜色、背景透明度均可自定义
- **自动保存进度** — 每本书的阅读位置（章节 + 滚动位置）自动保存与恢复
- **智能预加载** — 滑动窗口机制预加载相邻章节，切换流畅无等待
- **窗口管理** — 置顶、拖拽、调整大小，窗口位置与尺寸自动记忆
- **鼠标离开自动隐藏** — 可选功能，鼠标移出窗口时自动隐藏，移入时恢复
- **本地存储** — 所有数据存储在本地，无需联网，保护隐私

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite |
| 桌面框架 | Tauri v2 (Rust) |
| 文件处理 | jszip (EPUB 解压)、自定义解析器 |
| 平台 | macOS / Windows / Linux |

## 项目结构

```
stealthily-reader/
├── src/                        # 前端源码
│   ├── views/
│   │   ├── LibraryView.vue     # 书架界面
│   │   └── ReadingView.vue     # 阅读界面
│   ├── lib/
│   │   ├── epub-parser.ts      # EPUB 解析器
│   │   ├── txt-parser.ts       # TXT 章节识别
│   │   └── foliate-js/         # EPUB 解析库
│   ├── App.vue
│   ├── main.ts
│   └── router/
├── src-tauri/                  # Tauri 后端 (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs              # 核心命令与逻辑
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.77
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/) 前置依赖（macOS 需 Xcode Command Line Tools）

### 安装与运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run tauri dev

# 构建生产版本
npm run tauri build
```

## 数据存储

书籍数据存储在本地应用目录下：

```
~/Library/Application Support/com.stealthily.reader/
├── books/          # 书籍文件与元数据
├── settings.json   # 全局设置
└── window.json     # 窗口状态
```

## 许可证

ISC
