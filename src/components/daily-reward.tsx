"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";
import { useWalletStore } from "@/lib/wallet-store";

const STREAK_REWARDS = [10, 15, 20, 25, 30, 40, 50]; // Coins pro Tag 1-7
const STREAK_NAMES = ["Tag 1", "Tag 2", "Tag 3", "Tag 4", "Tag 5", "Tag 6", "Tag 7 🎉"];

export function DailyRewardPopup() {
  const { user } = useAuthStore();
  const { wallet, fetchWallet, addCoins } = useWalletStore();
  const [visible, setVisible] = useState(false);
  const [streakDay, setStreakDay] = useState(1);
  const [canClaim, setCanClaim] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkRewardStatus();
  }, [user]);

  const checkRewardStatus = async () => {
    if (!user) return;
    const supabase = createClient();

    // Prüfe, ob heute schon ein Reward geclaimed wurde
    const today = new Date().toISOString().split("T")[0];

    const { data: rewards } = await supabase
      .from("daily_rewards")
      .select("*")
      .eq("user_id", user.id)
      .order("streak_day", { ascending: false })
      .limit(1);

    if (rewards && rewards.length > 0) {
      const lastReward = rewards[0];
      const lastClaimDate = new Date(lastReward.claimed_at).toISOString().split("T")[0];

      if (lastClaimDate === today) {
        // Heute schon geclaimed
        setStreakDay(lastReward.streak_day);
        setCanClaim(false);
        setClaimed(true);
      } else {
        // Nächster Tag im Streak oder Reset
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        if (lastClaimDate === yesterday) {
          setStreakDay(lastReward.streak_day >= 7 ? 1 : lastReward.streak_day + 1);
        } else {
          setStreakDay(1); // Streak unterbrochen
        }
        setCanClaim(true);
        setVisible(true);
      }
    } else {
      // Noch nie geclaimed
      setStreakDay(1);
      setCanClaim(true);
      setVisible(true);
    }
  };

  const handleClaim = async () => {
    if (!user || !canClaim) return;
    setClaiming(true);

    const reward = STREAK_REWARDS[streakDay - 1] || 10;

    const success = await addCoins(
      user.id,
      reward,
      "daily_reward",
      `📅 Tägliche Belohnung – ${STREAK_NAMES[streakDay - 1]}: ${reward} Coins`,
      `daily_${streakDay}`
    );

    if (success) {
      // Reward in DB speichern
      const supabase = createClient();
      await supabase.from("daily_rewards").insert({
        user_id: user.id,
        streak_day: streakDay,
        coins_earned: reward,
      });

      await fetchWallet(user.id);
      setClaimed(true);
      setCanClaim(false);
    }
    setClaiming(false);
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible || !user) return null;

  const reward = STREAK_REWARDS[streakDay - 1] || 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-yellow-500/30 bg-gradient-to-b from-gray-900 to-gray-950 p-6 shadow-2xl text-center">
        <p className="text-4xl mb-2">📅</p>
        <h2 className="text-xl font-bold text-white">Tägliche Belohnung</h2>
        <p className="mt-1 text-sm text-gray-400">
          {STREAK_NAMES[streakDay - 1]} – Streak: {streakDay}/7
        </p>

        {/* Streak-Anzeige */}
        <div className="flex justify-center gap-1.5 my-4">
          {STREAK_REWARDS.map((r, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                i < streakDay
                  ? "bg-yellow-500 text-black"
                  : i === streakDay - 1
                    ? "bg-yellow-500 text-black ring-2 ring-yellow-300"
                    : "bg-gray-800 text-gray-600"
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {claimed ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <p className="text-green-400 font-bold">✅ +{reward} Coins erhalten!</p>
            <button
              onClick={handleDismiss}
              className="mt-3 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-500 transition"
            >
              Weiter
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <p className="text-3xl font-bold text-yellow-400">+{reward} 🪙</p>
            <p className="text-xs text-gray-500 mt-1">Heutige Belohnung</p>
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="mt-3 w-full rounded-xl bg-yellow-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-yellow-500 disabled:opacity-50 transition"
            >
              {claiming ? "Wird abgeholt..." : "Abholen!"}
            </button>
            <button
              onClick={handleDismiss}
              className="mt-2 text-xs text-gray-500 hover:text-gray-400 transition"
            >
              Später
            </button>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-600">
          Komm morgen wieder für Tag {streakDay >= 7 ? 1 : streakDay + 1}! 7-Tage-Streak = Bonus-Coins.
        </p>
      </div>
    </div>
  );
}