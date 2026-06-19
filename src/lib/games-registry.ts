// ─── Spiel-Registry ───────────────────────────────────────────

import { GameMetadata } from "@/types/game";

export const GAMES_REGISTRY: GameMetadata[] = [
  {
    slug: "flappy-clone",
    title: "Flappy Rocket",
    description:
      "Steuere eine Rakete durch endlose Hindernisse. Weiche den Barrieren aus und erziele den Highscore!",
    coverColor: "from-indigo-600 to-purple-700",
    minPlayers: 1,
    maxPlayers: 1,
    difficulty: "easy",
    tags: ["Arcade", "Geschicklichkeit", "Endlos"],
  },
  {
    slug: "street-racer",
    title: "Street Racer",
    description:
      "Rase durch den Gegenverkehr! Lenke links/rechts, gib Gas und weiche den entgegenkommenden Autos aus. Wie weit kommst du?",
    coverColor: "from-red-600 to-orange-600",
    minPlayers: 1,
    maxPlayers: 1,
    difficulty: "medium",
    tags: ["Rennspiel", "Geschicklichkeit", "Highscore"],
  },
  {
    slug: "alien-invasion",
    title: "Alien Invasion",
    description:
      "Außerirdische landen auf dem Mond! Klicke auf die grünen Aliens, bevor sie wieder verschwinden. Wie viele erwischst du in 30 Sekunden?",
    coverColor: "from-green-500 to-emerald-700",
    minPlayers: 1,
    maxPlayers: 1,
    difficulty: "easy",
    tags: ["Shooter", "Arcade", "Zeitlimit"],
  },
  // Weitere Spiele hier eintragen
];

export function getGameBySlug(slug: string): GameMetadata | undefined {
  return GAMES_REGISTRY.find((g) => g.slug === slug);
}