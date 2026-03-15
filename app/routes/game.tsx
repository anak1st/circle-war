import { useEffect, useRef } from "react";
import type { Route } from "./+types/game";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Circle War - Play" },
    { name: "description", content: "Single player Circle War with AI" },
  ];
}

// 游戏常量配置
const WORLD_SIZE = 5000;

class Circle {
  x: number;
  y: number;
  radius: number;
  color: string;
  name: string;

  constructor(x: number, y: number, radius: number, color: string, name: string = "") {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.name = name;
  }

  draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x - offsetX, this.y - offsetY, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();

    if (this.name) {
      ctx.fillStyle = "white";
      ctx.font = `${Math.max(12, this.radius / 2)}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(this.name, this.x - offsetX, this.y - offsetY + this.radius / 4);
    }
    ctx.restore();
  }
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 使用 Ref 存储游戏状态和按键状态
  const keysRef = useRef<{ [key: string]: boolean }>({
    w: false,
    a: false,
    s: false,
    d: false,
  });

  const gameStateRef = useRef({
    player: new Circle(WORLD_SIZE / 2, WORLD_SIZE / 2, 30, "#3b82f6", "Player"),
    camera: { x: 0, y: 0 },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) keysRef.current[key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) keysRef.current[key] = false;
    };

    const update = () => {
      const { player } = gameStateRef.current;
      const keys = keysRef.current;
      
      // 根据质量（半径）调整速度：球越大速度越慢
      const baseSpeed = 5;
      const speed = baseSpeed * Math.pow(30 / player.radius, 0.5);

      let dx = 0;
      let dy = 0;

      if (keys.w) dy -= speed;
      if (keys.s) dy += speed;
      if (keys.a) dx -= speed;
      if (keys.d) dx += speed;

      // 对角线移动速度归一化
      if (dx !== 0 && dy !== 0) {
        const factor = 1 / Math.sqrt(2);
        dx *= factor;
        dy *= factor;
      }

      player.x += dx;
      player.y += dy;

      // 边界检查
      player.x = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.x));
      player.y = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.y));
    };

    const render = () => {
      update(); // 每一帧先更新逻辑

      const { player, camera } = gameStateRef.current;

      // 1. 更新相机位置 (以玩家为中心)
      camera.x = player.x - canvas.width / 2;
      camera.y = player.y - canvas.height / 2;

      // 2. 清屏
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 3. 绘制背景网格 (随相机偏移)
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

      // 4. 绘制世界边界
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 5;
      ctx.strokeRect(-camera.x, -camera.y, WORLD_SIZE, WORLD_SIZE);

      // 5. 绘制玩家
      player.draw(ctx, camera.x, camera.y);

      animationFrameId = requestAnimationFrame(render);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    handleResize();
    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-gray-50">
      <canvas ref={canvasRef} className="block" />
      <div className="absolute top-4 left-4 pointer-events-none select-none">
        <h1 className="text-xl font-bold text-gray-800 opacity-30">Circle War (WASD to Move)</h1>
      </div>
    </main>
  );
}
