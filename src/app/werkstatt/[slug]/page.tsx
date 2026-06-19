"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";
import { useWalletStore } from "@/lib/wallet-store";
import type {
  Project,
  ProjectPart,
  WorkerType,
  ActiveCraft,
} from "@/types/monetization";

// ─── Typ für den UI-Zustand eines Teils ───────────────────────

type PartStatus = "locked" | "crafting" | "done";

interface PartUIState {
  part: ProjectPart;
  status: PartStatus;
  craft: ActiveCraft | null;
  timeRemaining: string;
}

// ─── Komponente ────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuthStore();
  const { wallet, fetchWallet, spendCoins } = useWalletStore();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [parts, setParts] = useState<ProjectPart[]>([]);
  const [workers, setWorkers] = useState<WorkerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [partStates, setPartStates] = useState<Map<number, PartUIState>>(new Map());
  const [modalPart, setModalPart] = useState<ProjectPart | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Daten laden ─────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user || !slug) return;
    const supabase = createClient();

    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .eq("slug", slug)
      .single();
    if (!projectData) { setLoading(false); return; }
    setProject(projectData as Project);
    const projectId = projectData.id;

    const { data: partsData } = await supabase
      .from("project_parts")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order");
    const partsList = (partsData as ProjectPart[]) ?? [];
    setParts(partsList);

    const { data: workersData } = await supabase
      .from("worker_types")
      .select("*");
    setWorkers((workersData as WorkerType[]) ?? []);

    const { data: invData } = await supabase
      .from("user_inventory")
      .select("part_id")
      .eq("user_id", user.id)
      .eq("project_id", projectId);
    const ownedPartIds = new Set((invData ?? []).map((i: { part_id: number }) => i.part_id));

    const { data: craftsData } = await supabase
      .from("active_crafts")
      .select("*, project_parts(*), worker_types(*)")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .eq("completed", false);

    const activeCrafts = (craftsData as ActiveCraft[]) ?? [];

    const { data: userProject } = await supabase
      .from("user_projects")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .maybeSingle();
    setIsCompleted(!!userProject);

    const stateMap = new Map<number, PartUIState>();
    for (const part of partsList) {
      const craft = activeCrafts.find((c) => c.part_id === part.id && !c.completed);
      if (ownedPartIds.has(part.id)) {
        if (craft) {
          stateMap.set(part.id, {
            part,
            status: "crafting",
            craft,
            timeRemaining: getTimeRemaining(craft.completes_at),
          });
        } else {
          stateMap.set(part.id, { part, status: "done", craft: null, timeRemaining: "" });
        }
      } else {
        stateMap.set(part.id, { part, status: "locked", craft: null, timeRemaining: "" });
      }
    }
    setPartStates(stateMap);
    setLoading(false);
  }, [user, slug]);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadData();
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadData]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      fetchWallet(user.id);
      loadData();
    }
  }, [user, loadData]);

  // ─── Helper ──────────────────────────────────────────────

  const getTimeRemaining = useCallback((completesAt: string) => {
    if (!mounted) return "Lädt...";
    const remaining = new Date(completesAt).getTime() - Date.now();
    if (remaining <= 0) return "Fertig!";
    const mins = Math.ceil(remaining / 60000);
    if (mins < 60) return `${mins} Min`;
    const hours = Math.floor(mins / 60);
    const minsRest = mins % 60;
    return `${hours}h ${minsRest}m`;
  }, [mounted]);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 4000);
  };

  const allDone = Array.from(partStates.values()).every((s) => s.status === "done");

  // ─── Kaufen + Arbeiter anstellen ─────────────────────────

  const handleBuyAndHire = async () => {
    if (!user || !project || !modalPart || !selectedWorker) return;

    // Lohn = Coins/Minute × Bauzeit in Minuten
    const totalMinutes = selectedWorker.base_speed;
    const workerCost = selectedWorker.min_pay * totalMinutes;
    const totalCost = modalPart.coin_cost + workerCost;

    if ((wallet?.balance ?? 0) < totalCost) {
      showMessage(`Nicht genug Coins! Du brauchst ${totalCost} 🪙`, "error");
      return;
    }

    const success1 = await spendCoins(
      user.id,
      modalPart.coin_cost,
      "part_buy",
      `🔩 ${modalPart.name} für ${project.name} gekauft`,
      `part_${modalPart.id}`
    );
    if (!success1) { showMessage("Fehler beim Kauf!", "error"); return; }

    const success2 = await spendCoins(
      user.id,
      workerCost,
      "worker_pay",
      `👷 ${selectedWorker.name} baut ${modalPart.name} für ${selectedWorker.min_pay} Coins/Min`,
      `worker_${selectedWorker.id}`
    );
    if (!success2) { showMessage("Fehler beim Anstellen des Arbeiters!", "error"); return; }

    const supabase = createClient();
    await supabase.from("user_inventory").insert({
      user_id: user.id,
      part_id: modalPart.id,
      project_id: project.id,
    });

    const completesAt = new Date(Date.now() + totalMinutes * 60 * 1000).toISOString();
    const { error } = await supabase.from("active_crafts").insert({
      user_id: user.id,
      project_id: project.id,
      part_id: modalPart.id,
      worker_type_id: selectedWorker.id,
      pay_per_hour: selectedWorker.min_pay,
      total_minutes: totalMinutes,
      completes_at: completesAt,
    });
    if (error) {
      showMessage("Fehler beim Starten des Auftrags!", "error");
      return;
    }

    await fetchWallet(user.id);
    await loadData();
    showMessage(
      `👷 ${selectedWorker.icon} ${selectedWorker.name} baut jetzt ${modalPart.icon} ${modalPart.name} – fertig in ${totalMinutes} Min.`,
      "success"
    );
    setModalPart(null);
    setSelectedWorker(null);
  };

  // ─── Projekt fertigstellen ───────────────────────────────

  const handleFinishProject = async () => {
    if (!user || !project) return;
    const supabase = createClient();
    const { error } = await supabase.from("user_projects").insert({
      user_id: user.id,
      project_id: project.id,
    });
    if (error) {
      showMessage("Fehler beim Abschließen!", "error");
      return;
    }
    setIsCompleted(true);
    showMessage(`🎉 ${project.name} komplett gebaut! Herzlichen Glückwunsch!`, "success");
  };

  // ─── Render-Zustände ─────────────────────────────────────

  if (!mounted || authLoading || loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <p className="text-gray-400 animate-pulse">Lade Projekt...</p>
      </div>
    );
  }
  if (!user || !project) return null;

  const sortedParts = parts.sort((a, b) => a.sort_order - b.sort_order);
  const cols = project.total_parts <= 10 ? 5 : project.total_parts <= 12 ? 4 : 5;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <button
          onClick={() => router.push("/werkstatt")}
          className="mb-4 text-sm text-gray-400 hover:text-white transition"
        >
          ← Zurück zur Werkstatt
        </button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <p className="mt-1 text-sm text-gray-400">{project.description}</p>
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
            <span>
              Fortschritt: {Array.from(partStates.values()).filter(s => s.status === "done").length}/{project.total_parts} Teile
            </span>
            {isCompleted && (
              <span className="rounded-full bg-green-500/20 px-3 py-0.5 text-xs font-bold text-green-400">
                ✅ Abgeschlossen
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-3">
          <span className="text-2xl">🪙</span>
          <div>
            <p className="text-xs text-gray-400">Guthaben</p>
            <p className="text-xl font-bold text-yellow-400">
              {wallet?.balance?.toLocaleString() ?? "0"}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-xl border p-4 text-center text-sm ${
            messageType === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {message}
        </div>
      )}

      {isCompleted && (
        <div className="mb-8 rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-emerald-500/5 p-8 text-center">
          <p className="text-5xl mb-3">
            {project.slug === "rennwagen" ? "🏎️" : project.slug === "raumschiff" ? "🚀" : "🏰"}
          </p>
          <h2 className="text-xl font-bold text-green-400">Projekt abgeschlossen!</h2>
          <p className="mt-2 text-gray-400">{project.name} ist fertig gebaut. Fantastische Arbeit!</p>

          {project.video_url && (() => {
            let embedUrl = project.video_url;
            const ytMatch = project.video_url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/);
            if (ytMatch) {
              embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
            }
            return (
              <div className="mt-6">
                <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-xl border border-gray-700" style={{ aspectRatio: "16 / 9" }}>
                  <iframe
                    src={embedUrl}
                    title={`${project.name} Video`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">🎬 Video zum fertigen Projekt</p>
              </div>
            );
          })()}
        </div>
      )}

      {!isCompleted && allDone && (
        <div className="mb-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-8 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <h2 className="text-xl font-bold text-yellow-400">Alle Teile gebaut!</h2>
          <p className="mt-2 text-gray-400">Zeit, das Projekt abzuschließen!</p>
          <button
            onClick={handleFinishProject}
            className="mt-4 rounded-xl bg-green-600 px-8 py-3 text-lg font-bold text-white hover:bg-green-500 transition animate-pulse"
          >
            🎉 {project.name} fertigstellen!
          </button>
        </div>
      )}

      {/* ─── PUZZLE-GRID ──────────────────────────────────── */}
      <div
        className="mb-8 grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {sortedParts.map((part) => {
          const state = partStates.get(part.id);
          const status = state?.status ?? "locked";
          const craft = state?.craft ?? null;
          const timeLeft = state?.timeRemaining ?? "";

          return (
            <button
              key={part.id}
              onClick={() => {
                if (status === "locked") setModalPart(part);
              }}
              disabled={status !== "locked"}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-3 pt-4 pb-3 text-center transition ${
                status === "done"
                  ? "border-green-500 bg-green-500/10 cursor-default"
                  : status === "crafting"
                    ? "border-green-400/60 bg-green-400/5 cursor-default"
                    : "border-gray-700 bg-gray-900 hover:border-gray-500 cursor-pointer"
              }`}
            >
              <span
                className={`text-2xl transition ${
                  status === "locked" ? "opacity-30 grayscale" : ""
                }`}
              >
                {part.icon}
              </span>
              <p className={`mt-1 text-[11px] leading-tight font-medium ${
                status === "locked" ? "text-gray-600" : "text-gray-200"
              }`}>
                {part.name}
              </p>
              {status === "locked" && (
                <p className="mt-1 text-[10px] font-bold text-yellow-500/70">
                  {part.coin_cost} 🪙
                </p>
              )}
              {status === "done" && (
                <span className="mt-1 text-xs text-green-400">✅</span>
              )}
              {status === "crafting" && craft && (
                <div className="mt-1 flex flex-col items-center gap-0.5">
                  <span className="animate-bounce text-sm">
                    {craft.worker_types?.icon ?? "👷"}
                  </span>
                  <span className="text-[10px] text-indigo-400 tabular-nums">
                    ⏳ {timeLeft}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── MODAL ─────────────────────────────────────────── */}
      {modalPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <p className="text-xl font-bold text-white">
              {modalPart.icon} {modalPart.name}
            </p>
            <p className="mt-1 text-sm text-gray-400">{modalPart.description}</p>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-800 bg-gray-800/50 p-3">
              <span className="text-sm text-gray-400">Teil-Preis</span>
              <span className="text-lg font-bold text-yellow-400">{modalPart.coin_cost} 🪙</span>
            </div>

            <p className="mt-5 mb-3 text-sm font-semibold text-gray-300">
              👷 Welcher Arbeiter soll es bauen?
            </p>
            <div className="space-y-2">
              {workers.map((worker) => {
                // Lohn = Coins/Minute × Bauzeit in Minuten
                const workerCost = worker.min_pay * worker.base_speed;
                const totalCost = modalPart.coin_cost + workerCost;
                const canAfford = (wallet?.balance ?? 0) >= totalCost;

                return (
                  <button
                    key={worker.id}
                    onClick={() => setSelectedWorker(worker)}
                    disabled={!canAfford}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedWorker?.id === worker.id
                        ? "border-indigo-500 bg-indigo-500/20"
                        : canAfford
                          ? "border-gray-700 hover:border-gray-500 bg-gray-800/50"
                          : "border-gray-800 bg-gray-800/30 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{worker.icon}</span>
                        <div>
                          <p className="font-medium text-white text-sm">{worker.name}</p>
                          <p className="text-[10px] text-gray-500">{worker.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Lohn</p>
                        <p className="text-sm font-bold text-yellow-400">{worker.min_pay} Coins/Min</p>
                        <p className="text-[10px] text-gray-500">⏱ {worker.base_speed} Min</p>
                      </div>
                    </div>
                    <div className="mt-2 text-right text-[10px] text-gray-500">
                      Gesamt: <span className={canAfford ? "text-yellow-400" : "text-red-400"}>{totalCost} 🪙</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setModalPart(null); setSelectedWorker(null); }}
                className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition"
              >
                Abbrechen
              </button>
              <button
                onClick={handleBuyAndHire}
                disabled={!selectedWorker}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
              >
                Kaufen & bauen lassen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}