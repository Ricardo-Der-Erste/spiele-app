import { GAMES_REGISTRY } from "@/lib/games-registry";
import { GameCard } from "@/components/game-card";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="mb-10 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          🎮 Willkommen bei <span className="text-indigo-400">SpieleHub</span>
        </h1>
        <p className="mt-3 mx-auto max-w-lg text-gray-400">
          Spiele endlose Minispiele, klettere in der Rangliste und miss dich mit Freunden. Mobile-first und ohne App-Download.
        </p>
      </section>

      {/* Spiele-Raster */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Spiele</h2>
        {GAMES_REGISTRY.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 p-12 text-center text-gray-500">
            Bald verfügbar! Schau in Kürze wieder vorbei.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {GAMES_REGISTRY.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}