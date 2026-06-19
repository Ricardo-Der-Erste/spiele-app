"use client";

import dynamic from "next/dynamic";

const StreetRacerGame = dynamic(
  () => import("@/games/street-racer/game").then((mod) => ({ default: mod.StreetRacerGame })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
        <p className="text-gray-400 animate-pulse">Spiel wird geladen...</p>
      </div>
    ),
  }
);

export function StreetRacerWrapper() {
  return <StreetRacerGame />;
}