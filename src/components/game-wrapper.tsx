"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { GameResultBanner } from "@/components/game-result-banner";

interface GameWrapperProps {
  slug: string;
  gameName: string;
}

// Dynamische Imports für alle Spiele
const FlappyRocketGame = dynamic(
  () => import("@/games/flappy-clone/game").then((mod) => ({ default: mod.FlappyRocketGame })),
  {
    ssr: false,
    loading: () => <GameLoading />,
  }
);

const StreetRacerGame = dynamic(
  () => import("@/games/street-racer/game").then((mod) => ({ default: mod.StreetRacerGame })),
  {
    ssr: false,
    loading: () => <GameLoading />,
  }
);

const AlienInvasionGame = dynamic(
  () => import("@/games/alien-invasion/game").then((mod) => ({ default: mod.AlienInvasionGame })),
  {
    ssr: false,
    loading: () => <GameLoading />,
  }
);

function GameLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
      <p className="text-gray-400 animate-pulse">Spiel wird geladen...</p>
    </div>
  );
}

type GameComponentProps = { onGameOver: (score: number) => void };

export function GameWrapper({ slug, gameName }: GameWrapperProps) {
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  const handleGameOver = useCallback(
    (score: number) => {
      setLastScore(score);
      setShowBanner(true);
    },
    []
  );

  const handleCloseBanner = useCallback(() => {
    setShowBanner(false);
    setLastScore(null);
  }, []);

  const renderGame = () => {
    const Flappy = FlappyRocketGame as React.ComponentType<GameComponentProps>;
    const Racer = StreetRacerGame as React.ComponentType<GameComponentProps>;
    const Alien = AlienInvasionGame as React.ComponentType<GameComponentProps>;

    switch (slug) {
      case "flappy-clone":
        return <Flappy onGameOver={handleGameOver} />;
      case "street-racer":
        return <Racer onGameOver={handleGameOver} />;
      case "alien-invasion":
        return <Alien onGameOver={handleGameOver} />;
      default:
        return <GameLoading />;
    }
  };

  return (
    <>
      {renderGame()}
      {showBanner && lastScore !== null && (
        <GameResultBanner
          score={lastScore}
          gameSlug={slug}
          gameName={gameName}
          onClose={handleCloseBanner}
        />
      )}
    </>
  );
}