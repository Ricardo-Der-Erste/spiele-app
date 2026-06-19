"use client";

import dynamic from "next/dynamic";

// Phaser benötigt `window` – nur client-seitig laden
const FlappyRocketGame = dynamic(
  () => import("@/games/flappy-clone/game").then((mod) => ({ default: mod.FlappyRocketGame })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
        <p className="text-gray-400 animate-pulse">Spiel wird geladen...</p>
      </div>
    ),
  }
);

export function FlappyWrapper() {
  return <FlappyRocketGame />;
}