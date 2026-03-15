import { useEffect, useRef } from "react";
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
const INITIAL_AI_COUNT = 10; // 初始 AI 敌人数量
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
   * @param offsetX 相机的 X 偏移量
   * @param offsetY 相机的 Y 偏移量
   */
  draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) {
    ctx.save();
    // 绘制圆形主体
    ctx.beginPath();
    ctx.arc(this.x - offsetX, this.y - offsetY, this.radius, 0, Math.PI * 2);
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
      ctx.fillText(this.name, this.x - offsetX, this.y - offsetY);
    }
    ctx.restore();
  }
}

/**
 * Game 组件：游戏的主逻辑入口
 */
export default function Game() {
  // Canvas DOM 引用
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // HUD 元素引用，用于直接操作 DOM 更新内容，避免 React 重绘开销
  const massRef = useRef<HTMLSpanElement>(null);
  const debugRef = useRef<HTMLDivElement>(null);
  
  // 记录按键状态，使用 Ref 避免触发 React 组件重绘
  const keysRef = useRef<{ [key: string]: boolean }>({
    w: false, a: false, s: false, d: false,
  });

  // 游戏核心状态：包括玩家实例、食物列表、AI 列表和相机位置
  const gameStateRef = useRef<{
    player: Circle;
    foods: Circle[];
    ais: Circle[];
    camera: { x: number; y: number };
  }>({
    player: new Circle(WORLD_SIZE / 2, WORLD_SIZE / 2, 30, "#3b82f6", "Player"),
    foods: [],
    ais: [],
    camera: { x: 0, y: 0 },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    /**
     * 生成初始 AI 敌人
     */
    const spawnAIs = () => {
      const { ais } = gameStateRef.current;
      while (ais.length < INITIAL_AI_COUNT) {
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

    // 初始化食物和 AI
    spawnFood();
    spawnAIs();

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
     * 每帧逻辑更新
     * 负责处理移动、边界检查、碰撞检测等
     */
    const update = () => {
      const { player, foods } = gameStateRef.current;
      const keys = keysRef.current;
      
      // 1. 计算玩家移动速度：球体越重（半径越大），速度越慢
      const baseSpeed = 5;
      const speed = baseSpeed * Math.pow(30 / player.radius, 0.5);

      let dx = 0;
      let dy = 0;

      if (keys.w) dy -= speed;
      if (keys.s) dy += speed;
      if (keys.a) dx -= speed;
      if (keys.d) dx += speed;

      // 2. 对角线移动速度归一化（防止斜向移动过快）
      if (dx !== 0 && dy !== 0) {
        const factor = 1 / Math.sqrt(2);
        dx *= factor;
        dy *= factor;
      }

      player.x += dx;
      player.y += dy;

      // 3. 地图边界限制：防止玩家跑出红框
      player.x = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.x));
      player.y = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.y));

      // 4. 碰撞检测：检查玩家是否碰到了食物
      for (let i = foods.length - 1; i >= 0; i--) {
        const food = foods[i];
        const distSq = Math.pow(player.x - food.x, 2) + Math.pow(player.y - food.y, 2);
        const minDist = player.radius + food.radius;

        if (distSq < Math.pow(minDist, 2)) {
          // 吞噬逻辑：按照面积增加的方式计算新半径
          player.radius = Math.sqrt(Math.pow(player.radius, 2) + Math.pow(food.radius, 2));
          foods.splice(i, 1);
        }
      }
      
      // 5. 自动补全食物点
      if (foods.length < FOOD_COUNT) {
        spawnFood();
      }
    };

    /**
     * 更新 HUD 面板文字
     * 直接修改 DOM 元素的 textContent 或 innerHTML 以获取最高性能
     */
    const updateHUD = () => {
      const { player, foods, ais } = gameStateRef.current;
      
      // 更新质量显示
      if (massRef.current) {
        massRef.current.textContent = `Mass: ${Math.floor(player.radius)}`;
      }

      // 更新 Debug 信息显示
      if (debugRef.current) {
        const maxAIRadius = ais.length > 0 ? Math.max(...ais.map(a => a.radius)) : 0;
        debugRef.current.innerHTML = `
          <div>Food: ${foods.length}</div>
          <div>AI Count: ${ais.length}</div>
          <div>Max AI Mass: ${Math.floor(maxAIRadius)}</div>
        `;
      }
    };

    /**
     * 每帧画面渲染
     * 负责清屏、计算相机偏移并绘制所有可见对象
     */
    const render = () => {
      // 先运行逻辑更新
      update();
      // 更新 HUD (Debug 信息)
      updateHUD();

      const { player, foods, ais, camera } = gameStateRef.current;

      // 1. 更新相机：使相机中心始终跟随玩家
      camera.x = player.x - canvas.width / 2;
      camera.y = player.y - canvas.height / 2;

      // 2. 清除上一帧内容
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 3. 绘制背景网格
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      const gridSize = 100;
      const startX = -camera.x % gridSize;
      const startY = -camera.y % gridSize;

      for (let x = startX; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = startY; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 4. 绘制世界边界（红框）
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 5;
      ctx.strokeRect(-camera.x, -camera.y, WORLD_SIZE, WORLD_SIZE);

      // 5. 绘制食物：只绘制屏幕内的食物点以提高渲染性能
      foods.forEach((food) => {
        if (
          food.x > camera.x - food.radius &&
          food.x < camera.x + canvas.width + food.radius &&
          food.y > camera.y - food.radius &&
          food.y < camera.y + canvas.height + food.radius
        ) {
          food.draw(ctx, camera.x, camera.y);
        }
      });

      // 6. 绘制 AI 敌人
      ais.forEach((ai) => {
        if (
          ai.x > camera.x - ai.radius &&
          ai.x < camera.x + canvas.width + ai.radius &&
          ai.y > camera.y - ai.radius &&
          ai.y < camera.y + canvas.height + ai.radius
        ) {
          ai.draw(ctx, camera.x, camera.y);
        }
      });

      // 7. 绘制玩家
      player.draw(ctx, camera.x, camera.y);

      // 循环调用
      animationFrameId = requestAnimationFrame(render);
    };

    // 绑定事件与启动循环
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    handleResize();
    render();

    // 组件卸载时清理资源
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
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

      {/* Debug 面板 (左下角) */}
      <div 
        ref={debugRef}
        className="absolute bottom-4 left-4 pointer-events-none select-none text-[10px] font-mono text-gray-400 bg-white/30 p-2 rounded"
      >
        {/* 由 updateHUD 填充 */}
      </div>

      {/* 质量显示 (右下角) */}
      <div className="absolute bottom-4 right-4 pointer-events-none select-none text-right">
        <span 
          ref={massRef}
          className="text-sm font-mono font-bold text-blue-600 bg-white/80 px-3 py-1 rounded-full shadow-lg border border-blue-100"
        >
          Mass: 30
        </span>
      </div>
    </main>
  );
}
