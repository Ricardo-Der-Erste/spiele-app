import { notFound } from "next/navigation";
import { getGameBySlug, GAMES_REGISTRY } from "@/lib/games-registry";
import { GameCard } from "@/components/game-card";
import { GameWrapper } from "@/components/game-wrapper";

export async function generateStaticParams() {
  return GAMES_REGISTRY.map((g) => ({ slug: g.slug }));
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) notFound();

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{game.title}</h1>
        <p className="mt-2 text-gray-400 max-w-xl">{game.description}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-medium ${
              game.difficulty === "easy"
                ? "bg-green-900/50 text-green-400"
                : game.difficulty === "medium"
                  ? "bg-yellow-900/50 text-yellow-400"
                  : "bg-red-900/50 text-red-400"
            }`}
          >
            {game.difficulty === "easy" ? "Leicht" : game.difficulty === "medium" ? "Mittel" : "Schwer"}
          </span>
          {game.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-gray-800 px-3 py-0.5 text-xs text-gray-400">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Game Canvas – Spiel anhand Slug auswählen */}
      {["flappy-clone", "street-racer", "alien-invasion"].includes(slug) ? (
        <GameWrapper slug={slug} gameName={game.title} />
      ) : (
        <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-gray-700 bg-gray-900">
          <p className="text-gray-500">Dieses Spiel wird noch entwickelt. 🚧</p>
        </div>
      )}

      {/* Andere Spiele */}
      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Weitere Spiele</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES_REGISTRY.filter((g) => g.slug !== slug).map((g) => (
            <GameCard key={g.slug} game={g} />
          ))}
        </div>
      </section>
    </div>
  );
}