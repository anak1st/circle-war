import type { Route } from "./+types/game";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Game" },
    { name: "description", content: "Play the game!" },
  ];
}

export default function Game() {
  return (
    <main>
      <h1 className="text-3xl font-bold">Game</h1>
    </main>
  );
}
