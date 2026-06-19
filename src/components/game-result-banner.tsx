"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { useWalletStore } from "@/lib/wallet-store";

interface GameResultBannerProps {
  score: number;
  gameSlug: string;
  gameName: string;
  onClose: () => void;
}

export function GameResultBanner({ score, gameSlug, gameName, onClose }: GameResultBannerProps) {
  const { user } = useAuthStore();
  const { wallet, fetchWallet } = useWalletStore();
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;

    // 5% des Scores als Coins (min 1, max 100)
    const earned = Math.max(1, Math.min(100, Math.floor(score * 0.05)));
    setCoinsEarned(earned);

    // Animation
    const timer = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(timer);
  }, [user, score]);

  useEffect(() => {
    if (show && user) {
      fetchWallet(user.id);
    }
  }, [show, user]);

  if (!user || !show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-gray-900 to-gray-950 p-6 shadow-2xl text-center">
        <p className="text-4xl mb-2">🏁</p>
        <h2 className="text-xl font-bold text-white">Spiel vorbei!</h2>
        <p className="mt-1 text-sm text-gray-400 capitalize">{gameName}</p>

        {/* Score */}
        <div className="my-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
          <p className="text-sm text-indigo-300">Punktzahl</p>
          <p className="text-3xl font-bold text-white tabular-nums">{score.toLocaleString()}</p>
        </div>

        {/* Coins verdient */}
        <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-sm text-yellow-300">Coins verdient</p>
          <p className="text-2xl font-bold text-yellow-400">+{coinsEarned} 🪙</p>
          <p className="text-xs text-gray-500 mt-1">5% deiner Punktzahl – automatisch gutgeschrieben</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition"
          >
            Erneut spielen
          </button>
          <Link
            href="/werkstatt"
            className="flex-1 rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-2.5 text-sm font-bold text-yellow-400 hover:bg-yellow-500/20 transition text-center"
          >
            🔨 Werkstatt
          </Link>
        </div>

        <p className="mt-4 text-xs text-gray-600">
          Investiere deine Coins in Bauprojekte – baue deinen Rennwagen, dein Raumschiff oder dein Schloss!
        </p>
      </div>
    </div>
  );
}