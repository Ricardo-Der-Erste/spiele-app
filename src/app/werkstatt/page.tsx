"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";
import { useWalletStore } from "@/lib/wallet-store";
import { useRouter } from "next/navigation";
import type { Project, ProjectProgress } from "@/types/monetization";

export default function WerkstattPage() {
  const { user, loading: authLoading } = useAuthStore();
  const { wallet, fetchWallet } = useWalletStore();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [progress, setProgress] = useState<Map<number, ProjectProgress>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetchWallet(user.id);
    loadWorkshop();
  }, [user]);

  const loadWorkshop = async () => {
    const supabase = createClient();

    // Alle Projekte laden
    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .eq("is_active", true);

    if (!projectData) {
      setLoading(false);
      return;
    }
    const projectsList = projectData as Project[];
    setProjects(projectsList);

    // Für jedes Projekt: Fortschritt berechnen
    const progressMap = new Map<number, ProjectProgress>();

    for (const project of projectsList) {
      // Inventar für dieses Projekt
      const { data: inventory } = await supabase
        .from("user_inventory")
        .select("*, project_parts(*)")
        .eq("user_id", user!.id)
        .eq("project_id", project.id);

      // Aktive Bau-Aufträge
      const { data: crafts } = await supabase
        .from("active_crafts")
        .select("*, project_parts(*), worker_types(*)")
        .eq("user_id", user!.id)
        .eq("project_id", project.id)
        .eq("completed", false);

      // Fertiggestellt?
      const { data: userProject } = await supabase
        .from("user_projects")
        .select("*")
        .eq("user_id", user!.id)
        .eq("project_id", project.id)
        .maybeSingle();

      const ownedPartIds = new Set(inventory?.map((i: { part_id: number }) => i.part_id) ?? []);
      const completedParts = crafts?.filter((c: { completed: boolean }) => c.completed).length ?? 0;

      progressMap.set(project.id, {
        project,
        ownedParts: ownedPartIds.size,
        totalParts: project.total_parts,
        completedParts: completedParts,
        inProgressCrafts: crafts ?? [],
        isCompleted: !!userProject,
      });
    }

    setProgress(progressMap);
    setLoading(false);
  };

  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case "fahrzeug":
        return "🏎️";
      case "raumfahrt":
        return "🚀";
      case "bauwerk":
        return "🏰";
      default:
        return "📦";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "fahrzeug":
        return "from-red-600 to-orange-600";
      case "raumfahrt":
        return "from-blue-600 to-indigo-600";
      case "bauwerk":
        return "from-amber-600 to-yellow-600";
      default:
        return "from-gray-600 to-gray-700";
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <p className="text-gray-400 animate-pulse">Lade Werkstatt...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">🔨 Werkstatt</h1>
        <p className="mt-1 text-gray-400">
          Baue legendäre Gegenstände – kaufe Ersatzteile und stelle Arbeiter ein!
        </p>
      </div>

      {/* Guthaben */}
      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <span className="text-2xl">🪙</span>
        <div>
          <p className="text-sm text-gray-400">Verfügbare Coins</p>
          <p className="text-xl font-bold text-yellow-400">
            {wallet?.balance?.toLocaleString() ?? "0"}
          </p>
        </div>
        <Link
          href="/shop"
          className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition"
        >
          Coins kaufen
        </Link>
      </div>

      {/* Projekt-Karten */}
      {loading ? (
        <div className="text-center text-gray-400 animate-pulse">Lade Projekte...</div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const p = progress.get(project.id);
            const owned = p?.ownedParts ?? 0;
            const total = p?.totalParts ?? 0;
            const percent = total > 0 ? Math.round((owned / total) * 100) : 0;
            const inProgress = p?.inProgressCrafts?.length ?? 0;

            return (
              <Link
                key={project.id}
                href={`/werkstatt/${project.slug}`}
                className={`group relative overflow-hidden rounded-2xl border transition hover:scale-[1.02] ${
                  p?.isCompleted
                    ? "border-green-500/30 bg-green-500/10"
                    : "border-gray-800 bg-gray-900 hover:border-gray-600"
                }`}
              >
                {/* Gradient-Banner */}
                <div
                  className={`h-24 bg-gradient-to-br ${getCategoryColor(project.category)} flex items-center justify-center`}
                >
                  <span className="text-4xl drop-shadow-lg">
                    {getCategoryEmoji(project.category)}
                  </span>
                </div>

                <div className="p-5">
                  {p?.isCompleted && (
                    <span className="inline-block rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white mb-2">
                      ✅ Fertiggestellt
                    </span>
                  )}

                  <h3 className="text-lg font-semibold text-white group-hover:text-yellow-400 transition">
                    {project.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-400 line-clamp-2">
                    {project.description}
                  </p>

                  {/* Fortschrittsbalken */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {p?.isCompleted ? "Komplett" : `${owned}/${total} Teile`}
                      </span>
                      <span>{percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          p?.isCompleted
                            ? "bg-green-500"
                            : percent > 50
                              ? "bg-yellow-500"
                              : "bg-indigo-500"
                        }`}
                        style={{ width: `${p?.isCompleted ? 100 : percent}%` }}
                      />
                    </div>
                  </div>

                  {inProgress > 0 && (
                    <p className="mt-2 text-xs text-indigo-400">
                      🔄 {inProgress} Teil{inProgress > 1 ? "e" : ""} in Arbeit
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="mt-10 rounded-xl border border-dashed border-gray-700 p-5 text-sm text-gray-500">
        <p className="font-medium text-gray-300 mb-2">🔧 So funktioniert's:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Kaufe Ersatzteile im Projekt-Shop</li>
          <li>Bezahle Arbeiter, um die Teile zusammenzubauen</li>
          <li>Je höher der Lohn, desto schneller arbeiten sie</li>
          <li>Sammle alle Teile → dein Projekt ist fertig!</li>
        </ol>
        <p className="mt-3 text-xs text-gray-600">
          Jedes Projekt hat viele Einzelschritte. Die Kosten summieren sich – aber das Ergebnis zählt!
        </p>
      </div>
    </div>
  );
}