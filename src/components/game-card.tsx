import Link from "next/link";
import type { GameMetadata } from "@/types/game";

export function GameCard({ game }: { game: GameMetadata }) {
  return (
    <Link
      href={`/games/${game.slug}`}
      className="group relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 transition hover:border-gray-600 hover:shadow-xl"
    >
      {/* Cover Art */}
      <div className={`h-40 bg-gradient-to-br ${game.coverColor} relative flex items-center justify-center`}>
        <span className="text-5xl drop-shadow-lg">
          {game.slug === "flappy-clone" ? "🚀" : game.slug === "street-racer" ? "🏎️" : game.slug === "alien-invasion" ? "👽" : "🎲"}
        </span>
        {/* Fahrbahn-Streifen für Street Racer */}
        {game.slug === "street-racer" && (
          <>
            <div className="absolute bottom-6 left-1/4 right-1/4 h-1 bg-white/20 rounded" />
            <div className="absolute bottom-10 left-1/3 right-1/3 h-1 bg-white/20 rounded" />
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition">
          {game.title}
        </h3>
        <p className="mt-1 text-sm text-gray-400 line-clamp-2">{game.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
            <span key={tag} className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-400">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}