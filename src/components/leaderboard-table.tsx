import type { HighscoreEntry } from "@/types/game";

export function LeaderboardTable({ entries }: { entries: HighscoreEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
        <p className="text-gray-400">Noch keine Einträge. Spiele ein Spiel und sichere dir den ersten Platz! 🏆</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-800 text-xs uppercase text-gray-400">
          <tr>
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Spieler</th>
            <th className="px-4 py-3 font-medium">Punkte</th>
            <th className="px-4 py-3 font-medium hidden sm:table-cell">Spiel</th>
            <th className="px-4 py-3 font-medium hidden sm:table-cell">Datum</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {entries.map((entry, index) => (
            <tr
              key={entry.id}
              className={index < 3 ? "bg-yellow-900/10" : undefined}
            >
              <td className="px-4 py-3 font-bold">
                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
              </td>
              <td className="px-4 py-3 text-white font-medium">
                {entry.profiles?.username ?? "Unbekannt"}
              </td>
              <td className="px-4 py-3 text-indigo-400 font-semibold tabular-nums">
                {entry.score.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-gray-400 hidden sm:table-cell capitalize">
                {entry.game_slug.replace("-", " ")}
              </td>
              <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                {new Date(entry.played_at).toLocaleDateString("de-DE")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}