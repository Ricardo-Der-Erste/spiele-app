"use client";

import dynamic from "next/dynamic";

const AlienInvasionGame = dynamic(
  () => import("@/games/alien-invasion/game").then((mod) => ({ default: mod.AlienInvasionGame })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
        <p className="text-gray-400 animate-pulse">Spiel wird geladen...</p>
      </div>
    ),
  }
);

export function AlienInvasionWrapper() {
  return <AlienInvasionGame />;
}