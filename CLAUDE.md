# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在本项目中提供指导。

## 项目概述

Circle War 是一款基于浏览器的单机游戏，灵感来自 Agar.io。玩家使用 WASD 键控制圆形移动，通过收集食物来成长，同时躲避 AI 控制的敌人。

## 常用命令

| 命令 | 说明 |
|---------|-------------|
| `pnpm dev` | 启动开发服务器，支持 HMR（端口 5173） |
| `pnpm build` | 创建生产构建 |
| `pnpm start` | 启动生产服务器 |
| `pnpm typecheck` | 运行 TypeScript 类型检查 |

## 架构

### 技术栈
- **框架**: React Router v7（SPA 模式，在 react-router.config.ts 中设置 `ssr: false`）
- **UI**: React 19 + TypeScript 5.9+
- **样式**: Tailwind CSS v4（配合 Vite 插件）
- **构建**: Vite 8
- **包管理器**: pnpm

### 游戏架构

游戏完全在 [app/routes/game.tsx](app/routes/game.tsx) 中实现，使用：
- **HTML5 Canvas** 进行渲染
- **requestAnimationFrame** 作为游戏循环
- **React refs** 管理可变游戏状态（避免游戏过程中触发重新渲染）
- **React state** 仅用于 HUD 更新（带节流）

### 核心游戏类/类型
- `Circle`: 所有圆形实体的基类（玩家、AI、食物）
  - 属性: `x`, `y`, `radius`, `color`, `name`，可选 `vx`, `vy`
  - 方法: `draw(ctx)` - 渲染圆形并动态调整文字大小

### 游戏常量
```typescript
WORLD_SIZE = 5000;        // 游戏世界尺寸
FOOD_COUNT = 1000;         // 食物颗粒最大数量
FOOD_RADIUS = 5;           // 食物颗粒大小
INITIAL_AI_COUNT = 20;     // 初始 AI 敌人数量
```

### 状态管理模式
```typescript
// 游戏状态存储在 ref 中（可变，不触发重新渲染）
const gameStateRef = useRef({ player, foods, ais, zoom });

// HUD 状态使用 useState（React 管理）
const [hudData, setHudData] = useState({ mass, isDead, ... });
```

### 路由结构
| 路径 | 组件 |
|------|-----------|
| `/` | `routes/home.tsx` - 带欢迎页的首页 |
| `/game` | `routes/game.tsx` - 主游戏画布 |

### 代码规范
- 游戏代码中的注释使用**中文**
- 路径别名: `~/*` 映射到 `./app/*`
- 游戏逻辑故意保持在单个文件中，以简化实现

## 未来开发

来自 task.md 的计划功能：
- AI 躲避逻辑（躲避更大的球）
- 实时排行榜（Top 5）
- 玩家昵称输入
- 死亡统计界面
- 吞噬粒子效果
- 分裂机制（空格键）
- 喷射质量机制（W 键）
- 四叉树碰撞优化
