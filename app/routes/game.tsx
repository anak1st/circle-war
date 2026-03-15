import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/game";

/**
 * 设置页面元数据
 */
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Circle War - Play" },
    { name: "description", content: "Single player Circle War with AI" },
  ];
}

// --- 游戏全局常量配置 ---
const WORLD_SIZE = 5000;    // 游戏地图的总宽度和高度
const FOOD_COUNT = 1000;    // 地图上同时存在的最大食物数量
const FOOD_RADIUS = 5;      // 食物点的基础半径
const INITIAL_AI_COUNT = 20; // 初始 AI 敌人数量
const COLORS = ["#ff4757", "#2ed573", "#1e90ff", "#ffa502", "#eccc68", "#70a1ff", "#7bed9f"]; // 随机颜色库

/**
 * Circle 类：游戏中的基础圆形对象
 * 用于表示玩家、AI 敌人或食物点。
 */
class Circle {
  x: number;       // 在游戏世界中的 X 坐标
  y: number;       // 在游戏世界中的 Y 坐标
  radius: number;  // 圆形的半径（代表质量）
  color: string;   // 圆形的填充颜色
  name: string;    // 显示在圆形中心的名称
  vx?: number;     // X 轴速度（用于 AI 移动）
  vy?: number;     // Y 轴速度（用于 AI 移动）

  /**
   * @param x 初始 X 坐标
   * @param y 初始 Y 坐标
   * @param radius 初始半径
   * @param color 颜色字符串
   * @param name (可选) 对象名称
   */
  constructor(x: number, y: number, radius: number, color: string, name: string = "") {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.name = name;
  }

  /**
   * 绘制圆形到 Canvas 上
   * @param ctx Canvas 绘图上下文
   */
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    // 绘制圆形主体
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();

    // 如果有名称，则绘制文字
    if (this.name) {
      ctx.fillStyle = "white";
      // 根据半径动态调整字体大小
      ctx.font = `${Math.max(10, this.radius / 2.5)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.name, this.x, this.y);
    }
    ctx.restore();
  }
}

// 排行榜数据项类型
interface LeaderboardEntry {
  name: string;
  radius: number;
  isPlayer: boolean;
}

/**
 * Game 组件：游戏的主逻辑入口
 */
export default function Game() {
  // Canvas DOM 引用
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // HUD 状态
  const [hudData, setHudData] = useState({
    mass: 30,
    isDead: false,
    respawnTimer: 0,
    foodCount: 0,
    aiCount: 0,
    zoom: 1.0,
    leaderboard: [] as LeaderboardEntry[],
  });
  
  // 记录按键状态，使用 Ref 避免触发 React 组件重绘
  const keysRef = useRef<{ [key: string]: boolean }>({
    w: false, a: false, s: false, d: false,
  });

  // 游戏核心状态：包括玩家实例、食物列表、AI 列表、缩放比例及死亡队列
  const gameStateRef = useRef<{
    player: Circle & { isDead: boolean; respawnTimer: number };
    foods: Circle[];
    ais: Circle[];
    zoom: number;
    deadAIQueue: number[]; // 存储 AI 的复活倒计时（帧数）
  }>({
    player: Object.assign(new Circle(WORLD_SIZE / 2, WORLD_SIZE / 2, 30, "#3b82f6", "Player"), {
      isDead: false,
      respawnTimer: 0,
    }),
    foods: [],
    ais: [],
    zoom: 1.0,
    deadAIQueue: [],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    /**
     * 生成 AI 敌人
     * @param count 要生成的数量
     */
    const spawnAIs = (count: number) => {
      const { ais } = gameStateRef.current;
      for (let i = 0; i < count; i++) {
        ais.push(
          new Circle(
            Math.random() * WORLD_SIZE,
            Math.random() * WORLD_SIZE,
            20 + Math.random() * 30,
            COLORS[Math.floor(Math.random() * COLORS.length)],
            `AI-${Math.floor(Math.random() * 1000)}`
          )
        );
      }
    };

    /**
     * 补充地图上的食物点
     * 当食物数量低于 FOOD_COUNT 时，在随机位置生成新食物
     */
    const spawnFood = () => {
      const { foods } = gameStateRef.current;
      while (foods.length < FOOD_COUNT) {
        foods.push(
          new Circle(
            Math.random() * WORLD_SIZE,
            Math.random() * WORLD_SIZE,
            FOOD_RADIUS,
            COLORS[Math.floor(Math.random() * COLORS.length)]
          )
        );
      }
    };

    // 初始化食物 and AI
    spawnFood();
    spawnAIs(INITIAL_AI_COUNT);

    /**
     * 处理窗口大小变化，确保 Canvas 铺满屏幕
     */
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    /**
     * 键盘按下事件处理
     */
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) keysRef.current[key] = true;
    };

    /**
     * 键盘松开事件处理
     */
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) keysRef.current[key] = false;
    };

    /**
     * 处理鼠标滚轮缩放
     */
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.001;
      const { current: state } = gameStateRef;
      // 限制缩放范围在 0.2x 到 3.0x 之间
      state.zoom = Math.max(0.2, Math.min(3.0, state.zoom - e.deltaY * zoomSpeed));
    };

    /**
     * 每帧逻辑更新
     * 负责处理移动、边界检查、碰撞检测等
     */
    const update = () => {
      const { player, foods, ais, deadAIQueue } = gameStateRef.current;
      const keys = keysRef.current;

      // --- 1. 玩家逻辑 (移动或复活倒计时) ---
      if (!player.isDead) {
        const baseSpeed = 5;
        const speed = baseSpeed * Math.pow(30 / player.radius, 0.5);

        let dx = 0;
        let dy = 0;
        if (keys.w) dy -= speed;
        if (keys.s) dy += speed;
        if (keys.a) dx -= speed;
        if (keys.d) dx += speed;

        if (dx !== 0 && dy !== 0) {
          const factor = 1 / Math.sqrt(2);
          dx *= factor;
          dy *= factor;
        }

        player.x += dx;
        player.y += dy;
        player.x = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.y));
      } else {
        // 死亡倒计时处理
        player.respawnTimer--;
        if (player.respawnTimer <= 0) {
          // 清除变量并随机位置复活
          player.isDead = false;
          player.radius = 30;
          player.x = Math.random() * WORLD_SIZE;
          player.y = Math.random() * WORLD_SIZE;
        }
      }

      // --- 2. AI 移动与边界限制 ---
      ais.forEach(ai => {
        const baseSpeed = 5;
        if (!ai.vx || !ai.vy || Math.random() < 0.02) {
          const angle = Math.random() * Math.PI * 2;
          const aiSpeed = baseSpeed * 0.8 * Math.pow(30 / ai.radius, 0.5);
          ai.vx = Math.cos(angle) * aiSpeed;
          ai.vy = Math.sin(angle) * aiSpeed;
        }
        ai.x += ai.vx;
        ai.y += ai.vy;

        // 边界反弹
        if (ai.x < ai.radius || ai.x > WORLD_SIZE - ai.radius) ai.vx *= -1;
        if (ai.y < ai.radius || ai.y > WORLD_SIZE - ai.radius) ai.vy *= -1;
        ai.x = Math.max(ai.radius, Math.min(WORLD_SIZE - ai.radius, ai.x));
        ai.y = Math.max(ai.radius, Math.min(WORLD_SIZE - ai.radius, ai.y));
      });

      // --- 3. 碰撞检测：玩家吃食物 (仅存活时) ---
      if (!player.isDead) {
        for (let i = foods.length - 1; i >= 0; i--) {
          const food = foods[i];
          const distSq = Math.pow(player.x - food.x, 2) + Math.pow(player.y - food.y, 2);
          if (distSq < Math.pow(player.radius, 2)) {
            player.radius = Math.sqrt(Math.pow(player.radius, 2) + Math.pow(food.radius, 2));
            foods.splice(i, 1);
          }
        }
      }

      // --- 4. 碰撞检测：玩家与 AI 吞噬 ---
      if (!player.isDead) {
        for (let i = ais.length - 1; i >= 0; i--) {
          const ai = ais[i];
          const distSq = Math.pow(player.x - ai.x, 2) + Math.pow(player.y - ai.y, 2);
          const dist = Math.sqrt(distSq);

          if (dist < player.radius && player.radius > ai.radius * 1.1) {
            // 玩家吃 AI
            player.radius = Math.sqrt(Math.pow(player.radius, 2) + Math.pow(ai.radius, 2));
            ais.splice(i, 1);
            deadAIQueue.push(300); // AI 进入 5 秒复活队列
          } else if (dist < ai.radius && ai.radius > player.radius * 1.1) {
            // AI 吃玩家
            player.isDead = true;
            player.respawnTimer = 300; // 5 秒倒计时
          }
        }
      }

      // --- 5. 碰撞检测：AI 之间吞噬 ---
      for (let i = ais.length - 1; i >= 0; i--) {
        for (let j = i - 1; j >= 0; j--) {
          const a = ais[i];
          const b = ais[j];
          const distSq = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
          const dist = Math.sqrt(distSq);

          if (dist < a.radius && a.radius > b.radius * 1.1) {
            a.radius = Math.sqrt(Math.pow(a.radius, 2) + Math.pow(b.radius, 2));
            ais.splice(j, 1);
            deadAIQueue.push(300); 
            if (i > j) i--;
          } else if (dist < b.radius && b.radius > a.radius * 1.1) {
            b.radius = Math.sqrt(Math.pow(b.radius, 2) + Math.pow(a.radius, 2));
            ais.splice(i, 1);
            deadAIQueue.push(300);
            break; 
          }
        }
      }

      // --- 6. AI 复活队列处理 ---
      for (let i = deadAIQueue.length - 1; i >= 0; i--) {
        deadAIQueue[i]--;
        if (deadAIQueue[i] <= 0) {
          deadAIQueue.splice(i, 1);
          spawnAIs(1); // 倒计时结束，在随机位置生成新 AI
        }
      }

      // --- 7. 自动补充食物 ---
      if (foods.length < FOOD_COUNT) spawnFood();
    };

    /**
     * 更新 HUD 状态
     */
    const updateHUDState = () => {
      const { player, foods, ais, zoom } = gameStateRef.current;
      
      // 合并玩家和 AI 并按半径排序
      const leaderboard = [
        { name: player.name, radius: player.radius, isPlayer: true },
        ...ais.map(ai => ({ name: ai.name, radius: ai.radius, isPlayer: false }))
      ].sort((a, b) => b.radius - a.radius).slice(0, 10);

      setHudData({
        mass: Math.floor(player.radius),
        isDead: player.isDead,
        respawnTimer: Math.ceil(player.respawnTimer / 60),
        foodCount: foods.length,
        aiCount: ais.length,
        zoom: zoom,
        leaderboard,
      });
    };

    /**
     * 每帧画面渲染
     * 负责清屏、计算相机偏移并绘制所有可见对象
     */
    const render = () => {
      // 先运行逻辑更新
      update();
      // 更新 HUD 状态 (React 将处理渲染)
      updateHUDState();

      const { player, foods, ais, zoom } = gameStateRef.current;

      // 1. 清除上一帧内容
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // --- 应用相机与缩放变换 ---
      // a. 将坐标原点移至屏幕中心
      ctx.translate(canvas.width / 2, canvas.height / 2);
      // b. 应用缩放比例
      ctx.scale(zoom, zoom);
      // c. 以玩家为中心进行位移（反向移动世界）
      ctx.translate(-player.x, -player.y);

      // 2. 绘制背景网格
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      const gridSize = 100;
      
      // 根据缩放后的视野动态计算网格绘制范围
      const viewW = canvas.width / zoom;
      const viewH = canvas.height / zoom;
      const startX = Math.floor((player.x - viewW / 2) / gridSize) * gridSize;
      const endX = Math.ceil((player.x + viewW / 2) / gridSize) * gridSize;
      const startY = Math.floor((player.y - viewH / 2) / gridSize) * gridSize;
      const endY = Math.ceil((player.y + viewH / 2) / gridSize) * gridSize;

      for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }

      // 3. 绘制世界边界（红框）
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 5;
      ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);

      // 4. 绘制食物：只绘制屏幕内的食物点以提高渲染性能
      foods.forEach((food) => {
        if (
          food.x > player.x - viewW / 2 - food.radius &&
          food.x < player.x + viewW / 2 + food.radius &&
          food.y > player.y - viewH / 2 - food.radius &&
          food.y < player.y + viewH / 2 + food.radius
        ) {
          food.draw(ctx);
        }
      });

      // 5. 绘制 AI 敌人
      ais.forEach((ai) => {
        if (
          ai.x > player.x - viewW / 2 - ai.radius &&
          ai.x < player.x + viewW / 2 + ai.radius &&
          ai.y > player.y - viewH / 2 - ai.radius &&
          ai.y < player.y + viewH / 2 + ai.radius
        ) {
          ai.draw(ctx);
        }
      });

      // 6. 绘制玩家 (仅在存活时绘制)
      if (!player.isDead) {
        player.draw(ctx);
      }

      ctx.restore();

      // 循环调用
      animationFrameId = requestAnimationFrame(render);
    };

    // 绑定事件与启动循环
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("wheel", handleWheel, { passive: false });
    handleResize();
    render();

    // 组件卸载时清理资源
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("wheel", handleWheel);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-gray-50 font-sans">
      {/* 游戏 Canvas 面板 */}
      <canvas ref={canvasRef} className="block" />
      
      {/* 标题 */}
      <div className="absolute top-4 left-4 pointer-events-none select-none">
        <h1 className="text-xl font-bold text-gray-800 opacity-20">Circle War</h1>
      </div>

      {/* 排行榜 (右上角) */}
      <div className="absolute top-4 right-4 pointer-events-none select-none text-[10px] font-mono text-gray-600 bg-white/50 p-3 rounded-lg shadow-sm border border-black/5 min-w-[120px]">
        <div className="font-bold border-b border-black/10 mb-1 pb-1">Leaderboard</div>
        {hudData.leaderboard.map((item, index) => (
          <div 
            key={`${item.name}-${index}`}
            className={`flex justify-between gap-5 ${item.isPlayer ? "text-blue-600 font-bold" : "text-gray-600"}`}
          >
            <span>{index + 1}. {item.name}</span>
            <span>{Math.floor(item.radius)}</span>
          </div>
        ))}
      </div>

      {/* 复活倒计时 Overlay */}
      {hudData.isDead && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-4xl font-bold pointer-events-none select-none">
          Respawning in {hudData.respawnTimer}s...
        </div>
      )}

      {/* Debug 面板 (左下角) */}
      <div className="absolute bottom-4 left-4 pointer-events-none select-none text-[10px] font-mono text-gray-400 bg-white/30 p-2 rounded">
        <div>Food: {hudData.foodCount}</div>
        <div>AI Count: {hudData.aiCount}</div>
        <div>Zoom: {hudData.zoom.toFixed(2)}x</div>
      </div>

      {/* 质量显示 (右下角) */}
      <div className="absolute bottom-4 right-4 pointer-events-none select-none text-right">
        <span className="text-sm font-mono font-bold text-blue-600 bg-white/80 px-3 py-1 rounded-full shadow-lg border border-blue-100">
          {hudData.isDead ? "Dead" : `Mass: ${hudData.mass}`}
        </span>
      </div>
    </main>
  );
}
