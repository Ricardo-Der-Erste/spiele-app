"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";
import { useWalletStore } from "@/lib/wallet-store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { UserProfile, HighscoreEntry } from "@/types/game";
import type { Transaction, UserInventoryItem, UserProject, Project } from "@/types/monetization";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuthStore();
  const { wallet, fetchWallet } = useWalletStore();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentScores, setRecentScores] = useState<HighscoreEntry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<UserInventoryItem[]>([]);
  const [userProjects, setUserProjects] = useState<(UserProject & { projects?: Project })[]>([]);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"scores" | "transactions" | "inventory">("scores");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetchWallet(user.id);

    const supabase = createClient();

    async function loadProfile() {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (profileData) {
        setProfile(profileData as UserProfile);
        setUsername(profileData.username || "");
      } else {
        setUsername(user?.user_metadata?.username || "");
      }

      // Letzte Scores
      const { data: scoresData } = await supabase
        .from("highscores")
        .select("*")
        .eq("user_id", user!.id)
        .order("played_at", { ascending: false })
        .limit(10);

      if (scoresData) setRecentScores(scoresData as HighscoreEntry[]);

      // Transaktionen
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (txData) setTransactions(txData as Transaction[]);

      // Inventar
      const { data: invData } = await supabase
        .from("user_inventory")
        .select("*, project_parts(*)")
        .eq("user_id", user!.id)
        .order("purchased_at", { ascending: false });

      if (invData) setInventory(invData as UserInventoryItem[]);

      // Fertige Projekte
      const { data: projData } = await supabase
        .from("user_projects")
        .select("*, projects(*)")
        .eq("user_id", user!.id);

      if (projData) setUserProjects(projData as (UserProject & { projects?: Project })[]);
    }

    loadProfile();
  }, [user]);

  const handleSaveUsername = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      username,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setMessage("❌ Fehler beim Speichern.");
    } else {
      setMessage("✅ Benutzername gespeichert!");
    }
    setSaving(false);
  };

  const getTransactionEmoji = (type: Transaction["type"]) => {
    switch (type) {
      case "purchase": return "💎";
      case "game_win": return "🎮";
      case "game_entry": return "🎫";
      case "daily_reward": return "📅";
      case "part_buy": return "🔩";
      case "worker_pay": return "👷";
      case "referral": return "👥";
      default: return "🪙";
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <p className="text-gray-400 animate-pulse">Lade Profil...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-2xl font-bold">👤 Mein Profil</h1>

      {/* Profilkarte */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-2xl font-bold">
            {username.charAt(0).toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-lg font-semibold text-white">{username || "Unbekannt"}</p>
            <p className="text-sm text-gray-400">{user.email}</p>
          </div>
        </div>

        <div className="flex gap-4 border-t border-gray-800 pt-4">
          <div>
            <p className="text-2xl font-bold text-indigo-400">
              {profile?.total_score?.toLocaleString() ?? 0}
            </p>
            <p className="text-xs text-gray-500">Gesamtpunkte</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-400">
              {profile?.games_played ?? 0}
            </p>
            <p className="text-xs text-gray-500">Spiele</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-400">
              🪙 {wallet?.balance?.toLocaleString() ?? "0"}
            </p>
            <p className="text-xs text-gray-500">Coins</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">
              {userProjects.length}
            </p>
            <p className="text-xs text-gray-500">Projekte</p>
          </div>
        </div>
      </div>

      {/* Fertige Projekte */}
      {userProjects.length > 0 && (
        <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <p className="mb-3 font-medium">🏆 Fertige Projekte</p>
          <div className="flex gap-3 flex-wrap">
            {userProjects.map((up) => (
              <Link
                key={up.id}
                href={`/werkstatt/${up.projects?.slug}`}
                className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-2 text-sm font-medium text-green-400 hover:bg-green-500/10 transition"
              >
                {up.projects?.name || `Projekt #${up.project_id}`}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Benutzername bearbeiten */}
      <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-4">
        <p className="font-medium">Benutzername bearbeiten</p>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
          placeholder="Dein Benutzername"
          maxLength={30}
          minLength={3}
        />
        <button
          onClick={handleSaveUsername}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          {saving ? "Speichere..." : "Speichern"}
        </button>
        {message && <p className="text-sm text-gray-300">{message}</p>}
      </div>

      {/* Tabs: Scores | Transaktionen | Inventar */}
      <div className="mt-6">
        <div className="flex gap-2 border-b border-gray-800">
          {(["scores", "transactions", "inventory"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab === "scores" ? "🎮 Spiele" : tab === "transactions" ? "🪙 Transaktionen" : "🔩 Inventar"}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {/* Scores */}
          {activeTab === "scores" && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
              {recentScores.length === 0 ? (
                <p className="text-sm text-gray-500">Noch keine Einträge.</p>
              ) : (
                <div className="divide-y divide-gray-800">
                  {recentScores.map((s) => (
                    <div key={s.id} className="flex justify-between py-2 text-sm">
                      <span className="text-gray-300 capitalize">{s.game_slug.replace("-", " ")}</span>
                      <span className="text-indigo-400 font-semibold tabular-nums">
                        {s.score.toLocaleString()} Pkt.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Transaktionen */}
          {activeTab === "transactions" && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-500">Noch keine Transaktionen.</p>
              ) : (
                <div className="divide-y divide-gray-800">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{getTransactionEmoji(tx.type)}</span>
                        <span className="text-gray-300">{tx.description || tx.type}</span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-semibold tabular-nums ${
                            tx.amount >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()} 🪙
                        </span>
                        <p className="text-xs text-gray-600">
                          {new Date(tx.created_at).toLocaleString("de-DE")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Inventar */}
          {activeTab === "inventory" && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
              {inventory.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-gray-500">Noch keine Teile im Inventar.</p>
                  <Link
                    href="/werkstatt"
                    className="mt-2 inline-block text-sm text-yellow-400 hover:underline"
                  >
                    Geh zur Werkstatt und kauf Ersatzteile!
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {inventory.map((item) => (
                    <div key={item.id} className="flex justify-between py-2.5 text-sm">
                      <div>
                        <span className="text-gray-300">
                          {item.project_parts?.icon} {item.project_parts?.name}
                        </span>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {new Date(item.purchased_at).toLocaleString("de-DE")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}