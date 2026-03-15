# Circle War 项目指南

## 项目概述

Circle War（球球大作战）是一款基于浏览器的单机游戏，灵感来自 Agar.io。玩家使用 WASD 键控制一个圆形实体，在一个大型游戏世界中移动，收集食物颗粒来成长，同时避开或吞噬 AI 控制的敌人。

## 技术栈

- **框架**: React Router v7（框架模式）
- **UI 库**: React 19
- **语言**: TypeScript 5.9+
- **样式**: Tailwind CSS v4（配合 Vite 插件）
- **构建工具**: Vite 8
- **包管理器**: pnpm（由 pnpm-lock.yaml 可知）
- **运行时**: Node.js 20+（Docker 中使用 Alpine Linux）

## 项目结构

```
.
├── app/                      # 应用程序源代码
│   ├── app.css              # 全局样式，包含 Tailwind 导入
│   ├── root.tsx             # 根布局和错误边界
│   ├── routes.ts            # 路由配置
│   └── routes/              # 路由模块
│       ├── home.tsx         # 首页（渲染 Welcome）
│       ├── game.tsx         # 主游戏逻辑（513 行）
│       └── welcome/         # Welcome 组件及图标
│           ├── welcome.tsx
│           ├── logo-dark.svg
│           └── logo-light.svg
├── public/                  # 静态资源
│   └── favicon.ico
├── build/                   # 构建输出（自动生成）
│   └── client/             # 静态客户端资源
├── package.json            # 依赖和脚本
├── tsconfig.json           # TypeScript 配置
├── vite.config.ts          # Vite 配置
├── react-router.config.ts  # React Router 配置（SPA 模式）
├── Dockerfile              # 多阶段 Docker 构建
├── task.md                 # 开发任务跟踪（中文）
└── AGENTS.md               # 本文件
```

## 架构

### 渲染模式
本项目以 **SPA（单页应用）** 模式运行，`react-router.config.ts` 中设置了 `ssr: false`。整个应用采用客户端渲染。

### 游戏架构
游戏引擎完全在 `app/routes/game.tsx` 中实现，使用：
- **HTML5 Canvas** 进行渲染
- **requestAnimationFrame** 作为游戏循环
- **React refs** 管理可变游戏状态（避免游戏过程中触发重新渲染）
- **React state** 仅用于 HUD 更新（通过渲染循环节流）

### 核心游戏类
- `Circle`: 所有圆形实体的基类（玩家、AI、食物）
  - 属性: `x`, `y`, `radius`, `color`, `name`, `vx?`, `vy?`
  - 方法: `draw(ctx)` - 渲染圆形并动态调整文字大小

### 游戏常量
```typescript
WORLD_SIZE = 5000;        // 游戏世界尺寸
FOOD_COUNT = 1000;        // 食物颗粒最大数量
FOOD_RADIUS = 5;          // 食物颗粒大小
INITIAL_AI_COUNT = 20;    // 初始 AI 敌人数量
```

## 可用脚本

| 命令 | 说明 |
|---------|-------------|
| `pnpm dev` | 启动开发服务器，支持 HMR（端口 5173） |
| `pnpm build` | 创建生产构建 |
| `pnpm start` | 启动生产服务器（运行 `build/server/index.js`） |
| `pnpm typecheck` | 运行 TypeScript 类型检查 |

## 构建流程

1. **开发**: Vite 开发服务器，支持 HMR 和 React Router 插件
2. **生产**: 
   - `react-router build` 将客户端资源生成到 `build/client/`
   - `react-router-serve` 提供应用服务

## Docker 部署

为多阶段优化的 Dockerfile：

```bash
# 使用 Docker 构建和运行
docker build -t circle-war .
docker run -p 3000:3000 circle-war
```

**构建阶段**：
1. `development-dependencies-env` - 安装所有依赖
2. `production-dependencies-env` - 仅安装生产依赖
3. `build-env` - 构建应用
4. 最终阶段 - 复制生产依赖和构建输出

## 代码风格指南

### TypeScript 配置
- 目标: ES2022
- 模块: ES2022，使用 bundler 解析
- 启用严格模式
- 路径别名: `~/*` 映射到 `./app/*`
- JSX 转换: `react-jsx`

### 注释规范
游戏代码中的注释使用**中文**：
- 章节标题（例如 `// --- 1. 玩家逻辑`）
- JSDoc 文档
- 内联说明

### Tailwind CSS
- 使用 Tailwind v4，语法为 `@import "tailwindcss"`
- 自定义主题，使用 Inter 字体
- 通过 `prefers-color-scheme` 支持暗黑模式

## 游戏控制

| 按键 | 操作 |
|-----|--------|
| `W` / `A` / `S` / `D` | 上/左/下/右移动 |
| `鼠标滚轮` | 缩放（0.2x - 3.0x） |

## 游戏机制

1. **移动**: 质量越大速度越慢（`speed = baseSpeed * sqrt(30 / radius)`）
2. **吞噬**: 实体如果比对方大 10% 且重叠时可以吞噬对方
3. **死亡**: 玩家死亡后 5 秒在随机位置复活，质量重置
4. **AI 行为**: 随机巡逻，碰到边界反弹，偶尔改变方向
5. **食物**: 静态颗粒，当数量低于阈值时重新生成

## 开发注意事项

### 状态管理模式
游戏使用混合方式：
```typescript
// 游戏状态存储在 ref 中（可变，不触发重新渲染）
const gameStateRef = useRef({ player, foods, ais, zoom });

// HUD 状态使用 useState（React 管理）
const [hudData, setHudData] = useState({ mass, isDead, ... });
```

### 性能优化
- 视口裁剪: 只渲染屏幕可见的实体
- 基于网格的背景渲染（根据缩放动态调整）
- 基于 ref 的输入处理，避免 React 开销

### 文件组织
- 所有游戏逻辑都在单个文件中（`game.tsx`），保持简单
- 没有单独的游戏引擎模块
- 路由模块遵循 React Router v7 约定

## 路由结构

| 路径 | 组件 | 说明 |
|------|-----------|-------------|
| `/` | `home.tsx` | 带欢迎链接的落地页 |
| `/game` | `game.tsx` | 主游戏画布 |

## 未来开发（来自 task.md）

计划实现但尚未完成的功能：
- AI 躲避逻辑（躲避大球逻辑）
- 实时排行榜（Top 5）
- 玩家昵称输入界面
- 死亡统计界面
- 吞噬粒子效果
- 分裂机制（空格键）
- 喷射质量机制（W 键）
- 四叉树碰撞优化

## 安全注意事项

- 无服务端渲染意味着所有逻辑都在客户端
- 无身份验证或持久化机制
- 游戏状态可通过浏览器开发者工具修改
- 仅适合休闲单机游戏体验
