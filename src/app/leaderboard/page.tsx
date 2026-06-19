"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LeaderboardTable } from "@/components/leaderboard-table";
import type { HighscoreEntry } from "@/types/game";
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<HighscoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all"); // "all" | game_slug
  const [games, setGames] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function fetchHighscores() {
      let query = supabase
        .from("highscores")
        .select("*, profiles(username, avatar_url)")
        .order("score", { ascending: false })
        .limit(50);

      if (filter !== "all") {
        query = query.eq("game_slug", filter);
      }

      const { data } = await query;
      if (data) setEntries(data as HighscoreEntry[]);
      setLoading(false);
    }

    async function fetchGames() {
      const { data } = await supabase
        .from("highscores")
        .select("game_slug");

      if (data) {
        const slugs = [...new Set(data.map((h) => h.game_slug))] as string[];
        setGames(slugs);
      }
    }

    fetchHighscores();
    fetchGames();

    // Echtzeit-Subscription
    let channel: RealtimeChannel;
    try {
      channel = supabase
        .channel("highscores-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "highscores" },
          () => {
            fetchHighscores(); // re-fetch bei Änderung
          }
        )
        .subscribe();
    } catch {
      // Realtime nicht verfügbar (kein Supabase-Projekt gelinkt)
    }

    return () => {
      channel?.unsubscribe();
    };
  }, [filter]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">🏆 Rangliste</h1>

      {/* Filter */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            filter === "all"
              ? "bg-indigo-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Alle Spiele
        </button>
        {games.map((slug) => (
          <button
            key={slug}
            onClick={() => setFilter(slug)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
              filter === slug
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {slug.replace("-", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="text-gray-400 animate-pulse">Lade Rangliste...</p>
        </div>
      ) : (
        <LeaderboardTable entries={entries} />
      )}
    </div>
  );
}