// ─── Monetarisierungs-Typen ─────────────────────────────────────

export interface CoinPackage {
  id: number;
  name: string;
  coins: number;
  price_cents: number;
  bonus_coins: number;
  is_active: boolean;
  sort_order: number;
}

export interface Wallet {
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  user_id: string;
  amount: number;
  type: "purchase" | "game_win" | "game_entry" | "daily_reward" | "part_buy" | "worker_pay" | "referral";
  description: string | null;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

export interface Project {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  category: "fahrzeug" | "raumfahrt" | "bauwerk";
  total_parts: number;
  is_active: boolean;
}

export interface ProjectPart {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  coin_cost: number;
  sort_order: number;
  icon: string;
}

export interface WorkerType {
  id: number;
  name: string;
  description: string | null;
  base_speed: number; // Basis-Minuten pro Teil
  min_pay: number;
  max_pay: number;
  icon: string;
}

export interface UserInventoryItem {
  id: number;
  user_id: string;
  part_id: number;
  project_id: number;
  quantity: number;
  purchased_at: string;
  // Join
  project_parts?: ProjectPart;
}

export interface ActiveCraft {
  id: number;
  user_id: string;
  project_id: number;
  part_id: number;
  worker_type_id: number;
  pay_per_hour: number;
  total_minutes: number;
  started_at: string;
  completes_at: string;
  completed: boolean;
  completed_at: string | null;
  // Joins
  project_parts?: ProjectPart;
  worker_types?: WorkerType;
}

export interface UserProject {
  id: number;
  user_id: string;
  project_id: number;
  completed_at: string;
  display_order: number;
  // Join
  projects?: Project;
}

export interface DailyReward {
  id: number;
  user_id: string;
  streak_day: number;
  coins_earned: number;
  claimed_at: string;
}

export interface DailyChallenge {
  id: number;
  challenge_date: string;
  game_slug: string;
  goal_type: "score" | "plays" | "win_streak";
  goal_value: number;
  reward_coins: number;
  description: string | null;
  is_active: boolean;
}

export interface UserChallenge {
  id: number;
  user_id: string;
  challenge_id: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  updated_at: string;
  // Join
  daily_challenges?: DailyChallenge;
}

// Projekt-Fortschritt für UI
export interface ProjectProgress {
  project: Project;
  ownedParts: number;
  totalParts: number;
  completedParts: number;
  inProgressCrafts: ActiveCraft[];
  isCompleted: boolean;
}