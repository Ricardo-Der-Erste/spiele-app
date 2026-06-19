// ─── Spiel-Typen ──────────────────────────────────────────────

export interface GameMetadata {
  slug: string;
  title: string;
  description: string;
  coverColor: string; // Tailwind-Gradient-Klasse z.B. "from-purple-600 to-pink-500"
  minPlayers: number;
  maxPlayers: number;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
}

export interface HighscoreEntry {
  id: string;
  user_id: string;
  game_slug: string;
  score: number;
  played_at: string;
  // Join via Supabase
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

export interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  total_score: number;
  games_played: number;
}