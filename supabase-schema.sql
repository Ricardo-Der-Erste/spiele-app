-- ============================================================================
-- Supabase Schema für SpieleHub – Vollständig mit Monetarisierung
-- ============================================================================
-- In Supabase SQL Editor ausführen (https://supabase.com/dashboard)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. BESTEHENDE TABELLEN (unverändert)
-- ═══════════════════════════════════════════════════════════════════════════

-- Profiles Tabelle
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  avatar_url  TEXT,
  total_score INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutzer können alle Profile sehen" ON public.profiles;
CREATE POLICY "Nutzer können alle Profile sehen"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Nutzer können ihr eigenes Profil bearbeiten" ON public.profiles;
CREATE POLICY "Nutzer können ihr eigenes Profil bearbeiten"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Nutzer können ihr eigenes Profil aktualisieren" ON public.profiles;
CREATE POLICY "Nutzer können ihr eigenes Profil aktualisieren"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Highscores Tabelle
CREATE TABLE IF NOT EXISTS public.highscores (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_slug   TEXT NOT NULL,
  score       INTEGER NOT NULL CHECK (score >= 0),
  played_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highscores_score
  ON public.highscores (game_slug, score DESC);

CREATE INDEX IF NOT EXISTS idx_highscores_user
  ON public.highscores (user_id, played_at DESC);

ALTER TABLE public.highscores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jeder kann Highscores lesen" ON public.highscores;
CREATE POLICY "Jeder kann Highscores lesen"
  ON public.highscores FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Eingeloggte Nutzer können Scores einfügen" ON public.highscores;
CREATE POLICY "Eingeloggte Nutzer können Scores einfügen"
  ON public.highscores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Keine Updates an Scores" ON public.highscores;
CREATE POLICY "Keine Updates an Scores"
  ON public.highscores FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "Keine Löschungen an Scores" ON public.highscores;
CREATE POLICY "Keine Löschungen an Scores"
  ON public.highscores FOR DELETE
  USING (false);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. MONETARISIERUNG – COIN-SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

-- 2a. Coin-Pakete (Shop)
CREATE TABLE IF NOT EXISTS public.coin_packages (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  coins         INTEGER NOT NULL CHECK (coins > 0),
  price_cents   INTEGER NOT NULL CHECK (price_cents > 0), -- Preis in Euro-Cent
  bonus_coins   INTEGER DEFAULT 0, -- "Gratis"-Coins obendrauf
  is_active     BOOLEAN DEFAULT true,
  sort_order    INTEGER DEFAULT 0
);

-- 2b. Benutzer-Wallets (Coin-Guthaben)
CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance       INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned  INTEGER NOT NULL DEFAULT 0, -- Lebenszeit verdient (Spiele, Boni)
  total_spent   INTEGER NOT NULL DEFAULT 0, -- Lebenszeit ausgegeben
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutzer sehen nur eigene Wallet" ON public.user_wallets;
CREATE POLICY "Nutzer sehen nur eigene Wallet"
  ON public.user_wallets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System kann Wallets anlegen" ON public.user_wallets;
CREATE POLICY "System kann Wallets anlegen"
  ON public.user_wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System kann Wallets aktualisieren" ON public.user_wallets;
CREATE POLICY "System kann Wallets aktualisieren"
  ON public.user_wallets FOR UPDATE
  USING (auth.uid() = user_id);

-- 2c. Transaktions-Historie (Audit-Trail)
CREATE TABLE IF NOT EXISTS public.transactions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount          INTEGER NOT NULL, -- positiv = Einnahme, negativ = Ausgabe
  type            TEXT NOT NULL, -- 'purchase', 'game_win', 'game_entry', 'daily_reward', 'part_buy', 'worker_pay', 'referral'
  description     TEXT,
  reference_id    TEXT, -- z.B. game_slug, package_id, part_id
  balance_after   INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user
  ON public.transactions (user_id, created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutzer sehen nur eigene Transaktionen" ON public.transactions;
CREATE POLICY "Nutzer sehen nur eigene Transaktionen"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System kann Transaktionen einfügen" ON public.transactions;
CREATE POLICY "System kann Transaktionen einfügen"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CRAFTING-SYSTEM – Bauprojekte
-- ═══════════════════════════════════════════════════════════════════════════

-- 3a. Projekte (die 3 Haupt-Gegenstände)
CREATE TABLE IF NOT EXISTS public.projects (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  video_url       TEXT, -- optionales Video nach Abschluss
  category        TEXT NOT NULL, -- 'fahrzeug', 'raumfahrt', 'bauwerk'
  total_parts     INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Spalte nachrüsten falls Tabelle schon existiert
DO $$ BEGIN
  ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS video_url TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jeder kann Projekte lesen" ON public.projects;
CREATE POLICY "Jeder kann Projekte lesen"
  ON public.projects FOR SELECT
  USING (true);

-- 3b. Bau-Teile (Ersatzteile pro Projekt)
CREATE TABLE IF NOT EXISTS public.project_parts (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  coin_cost       INTEGER NOT NULL CHECK (coin_cost > 0), -- Preis in Coins
  sort_order      INTEGER DEFAULT 0,
  icon            TEXT DEFAULT '🔧'
);

ALTER TABLE public.project_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jeder kann Bauteile lesen" ON public.project_parts;
CREATE POLICY "Jeder kann Bauteile lesen"
  ON public.project_parts FOR SELECT
  USING (true);

-- 3c. Arbeiter-Typen
CREATE TABLE IF NOT EXISTS public.worker_types (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  base_speed      INTEGER NOT NULL DEFAULT 60, -- Bauzeit in Minuten
  min_pay         INTEGER NOT NULL DEFAULT 10, -- Lohn in Coins pro Minute
  max_pay         INTEGER NOT NULL DEFAULT 100, -- Maximallohn in Coins/Minute
  icon            TEXT DEFAULT '👷'
);

ALTER TABLE public.worker_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jeder kann Arbeiter-Typen lesen" ON public.worker_types;
CREATE POLICY "Jeder kann Arbeiter-Typen lesen"
  ON public.worker_types FOR SELECT
  USING (true);

-- 3d. Benutzer-Inventar (gekaufte Teile)
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  part_id         BIGINT NOT NULL REFERENCES public.project_parts(id),
  project_id      BIGINT NOT NULL REFERENCES public.projects(id),
  quantity        INTEGER NOT NULL DEFAULT 1,
  purchased_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_user
  ON public.user_inventory (user_id, project_id);

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutzer sehen nur eigenes Inventar" ON public.user_inventory;
CREATE POLICY "Nutzer sehen nur eigenes Inventar"
  ON public.user_inventory FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Nutzer können Teile kaufen" ON public.user_inventory;
CREATE POLICY "Nutzer können Teile kaufen"
  ON public.user_inventory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3e. Aktive Bau-Aufträge
CREATE TABLE IF NOT EXISTS public.active_crafts (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id      BIGINT NOT NULL REFERENCES public.projects(id),
  part_id         BIGINT NOT NULL REFERENCES public.project_parts(id),
  worker_type_id  BIGINT NOT NULL REFERENCES public.worker_types(id),
  pay_per_hour    INTEGER NOT NULL CHECK (pay_per_hour > 0),
  total_minutes   INTEGER NOT NULL, -- Gesamtdauer in Minuten
  started_at      TIMESTAMPTZ DEFAULT now(),
  completes_at    TIMESTAMPTZ NOT NULL,
  completed       BOOLEAN DEFAULT false,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crafts_user
  ON public.active_crafts (user_id, completed);

ALTER TABLE public.active_crafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutzer sehen nur eigene Aufträge" ON public.active_crafts;
CREATE POLICY "Nutzer sehen nur eigene Aufträge"
  ON public.active_crafts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Nutzer können Aufträge starten" ON public.active_crafts;
CREATE POLICY "Nutzer können Aufträge starten"
  ON public.active_crafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Nutzer können Aufträge abschließen" ON public.active_crafts;
CREATE POLICY "Nutzer können Aufträge abschließen"
  ON public.active_crafts FOR UPDATE
  USING (auth.uid() = user_id);

-- 3f. Fertige Projekte der Nutzer
CREATE TABLE IF NOT EXISTS public.user_projects (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id      BIGINT NOT NULL REFERENCES public.projects(id),
  completed_at    TIMESTAMPTZ DEFAULT now(),
  display_order   INTEGER DEFAULT 0,
  UNIQUE(user_id, project_id)
);

ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jeder kann fertige Projekte sehen" ON public.user_projects;
CREATE POLICY "Jeder kann fertige Projekte sehen"
  ON public.user_projects FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Nutzer können Projekte abschließen" ON public.user_projects;
CREATE POLICY "Nutzer können Projekte abschließen"
  ON public.user_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. WIEDERKOMM-MECHANIKEN
-- ═══════════════════════════════════════════════════════════════════════════

-- 4a. Tägliche Login-Belohnungen
CREATE TABLE IF NOT EXISTS public.daily_rewards (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  streak_day      INTEGER NOT NULL DEFAULT 1 CHECK (streak_day BETWEEN 1 AND 7),
  coins_earned    INTEGER NOT NULL,
  claimed_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, streak_day)
);

ALTER TABLE public.daily_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutzer sehen nur eigene Rewards" ON public.daily_rewards;
CREATE POLICY "Nutzer sehen nur eigene Rewards"
  ON public.daily_rewards FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Nutzer können Rewards claimen" ON public.daily_rewards;
CREATE POLICY "Nutzer können Rewards claimen"
  ON public.daily_rewards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4b. Tägliche Challenges
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id              BIGSERIAL PRIMARY KEY,
  challenge_date  DATE NOT NULL,
  game_slug       TEXT NOT NULL,
  goal_type       TEXT NOT NULL, -- 'score', 'plays', 'win_streak'
  goal_value      INTEGER NOT NULL,
  reward_coins    INTEGER NOT NULL,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  UNIQUE(challenge_date, game_slug, goal_type, goal_value)
);

CREATE TABLE IF NOT EXISTS public.user_challenges (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id    BIGINT NOT NULL REFERENCES public.daily_challenges(id),
  progress        INTEGER DEFAULT 0,
  completed       BOOLEAN DEFAULT false,
  claimed         BOOLEAN DEFAULT false,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutzer sehen nur eigene Challenges" ON public.user_challenges;
CREATE POLICY "Nutzer sehen nur eigene Challenges"
  ON public.user_challenges FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System kann Challenge-Fortschritt updaten" ON public.user_challenges;
CREATE POLICY "System kann Challenge-Fortschritt updaten"
  ON public.user_challenges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Nutzer können Fortschritt aktualisieren" ON public.user_challenges;
CREATE POLICY "Nutzer können Fortschritt aktualisieren"
  ON public.user_challenges FOR UPDATE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. TRIGGER & AUTOMATISIERUNGEN
-- ═══════════════════════════════════════════════════════════════════════════

-- 5a. Wallet automatisch anlegen bei neuem Profil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'spieler_' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  -- Wallet mit 50 Start-Coins anlegen
  INSERT INTO public.user_wallets (user_id, balance, total_earned)
  VALUES (NEW.id, 50, 50);
  -- Willkommens-Transaktion
  INSERT INTO public.transactions (user_id, amount, type, description, balance_after)
  VALUES (NEW.id, 50, 'daily_reward', '🎁 Willkommensbonus – 50 Coins geschenkt!', 50);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5b. Wallet für bestehende Nutzer nachrüsten
CREATE OR REPLACE FUNCTION public.ensure_wallet_exists()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id, balance, total_earned)
  VALUES (NEW.id, 50, 50)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_wallet_on_profile ON public.profiles;
CREATE TRIGGER ensure_wallet_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_wallet_exists();

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. SEED-DATEN
-- ═══════════════════════════════════════════════════════════════════════════

-- 6a. Coin-Pakete (Preise so gestaltet, dass ~500€ = ~32.500 Coins)
--    2.99€=100, 9.99€=400, 24.99€=1200, 49.99€=2800, 99.99€=6500
ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;

-- Stelle sicher, dass UNIQUE-Constraints existieren (für Tabellen, die schon existieren)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coin_packages_name_key' AND conrelid = 'public.coin_packages'::regclass) THEN
    ALTER TABLE public.coin_packages ADD CONSTRAINT coin_packages_name_key UNIQUE (name);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worker_types_name_key'
    AND conrelid = 'public.worker_types'::regclass) THEN
    ALTER TABLE public.worker_types ADD CONSTRAINT worker_types_name_key UNIQUE (name);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_challenges_unique'
    AND conrelid = 'public.daily_challenges'::regclass) THEN
    ALTER TABLE public.daily_challenges ADD CONSTRAINT daily_challenges_unique UNIQUE (challenge_date, game_slug, goal_type, goal_value);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DROP POLICY IF EXISTS "Jeder kann Coin-Pakete lesen" ON public.coin_packages;
CREATE POLICY "Jeder kann Coin-Pakete lesen"
  ON public.coin_packages FOR SELECT
  USING (true);

INSERT INTO public.coin_packages (name, coins, price_cents, bonus_coins, sort_order) VALUES
  ('Starter', 100, 299, 0, 1),
  ('Bronze', 400, 999, 50, 2),
  ('Silber', 1200, 2499, 200, 3),
  ('Gold', 2800, 4999, 500, 4),
  ('Diamant', 6500, 9999, 1000, 5)
ON CONFLICT (name) DO UPDATE SET
  coins = EXCLUDED.coins,
  price_cents = EXCLUDED.price_cents,
  bonus_coins = EXCLUDED.bonus_coins,
  sort_order = EXCLUDED.sort_order;

-- 6b. Bau-Projekte
INSERT INTO public.projects (slug, name, description, video_url, category, total_parts) VALUES
  ('rennwagen', '🏎️ Rennwagen', 'Baue deinen eigenen Sportwagen! Sammle Motorteile, Karosserie, Reifen und mehr.', NULL, 'fahrzeug', 10),
  ('raumschiff', '🚀 Raumschiff', 'Ein interstellares Raumschiff entsteht! Triebwerke, Navigationssystem, Hülle – alles muss her.', 'https://youtu.be/l0i8lwDSkeE', 'raumfahrt', 12),
  ('maerchenschloss', '🏰 Märchenschloss', 'Dein eigenes Königreich! Türme, Zugbrücke, Thronsaal und viele edle Steine.', NULL, 'bauwerk', 15)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  video_url = EXCLUDED.video_url,
  category = EXCLUDED.category,
  total_parts = EXCLUDED.total_parts;

-- 6c. Ersatzteile – Rennwagen (10 Teile, Summe ~10.850 Coins)
DO $$
DECLARE
  rennwagen_id BIGINT;
BEGIN
  SELECT id INTO rennwagen_id FROM public.projects WHERE slug = 'rennwagen';
  INSERT INTO public.project_parts (project_id, name, description, coin_cost, sort_order, icon) VALUES
    (rennwagen_id, 'Motorblock', 'Hochleistungs-V8 Motorblock – das Herzstück deines Rennwagens', 2500, 1, '🔩'),
    (rennwagen_id, 'Turbolader', 'Doppel-Turbo für maximale Leistung auf der Rennstrecke', 1800, 2, '💨'),
    (rennwagen_id, 'Rennfahrwerk', 'Tiefergelegtes Sportfahrwerk mit adaptiver Dämpfung', 1200, 3, '⚙️'),
    (rennwagen_id, 'Carbon-Karosserie', 'Leichtbau-Karosserie aus echtem Carbon – jedes Gramm zählt', 1500, 4, '🚗'),
    (rennwagen_id, 'Sportreifen', '4 Semi-Slick Reifen für optimale Bodenhaftung', 800, 5, '🛞'),
    (rennwagen_id, 'Rennsitze', '2 Schalensitze mit 5-Punkt-Gurten', 600, 6, '💺'),
    (rennwagen_id, 'Auspuffanlage', 'Sportauspuff mit Klappensteuerung für den perfekten Sound', 700, 7, '💨'),
    (rennwagen_id, 'Bremsanlage', 'Hochleistungs-Bremsen mit gelochten Scheiben', 650, 8, '🛑'),
    (rennwagen_id, 'Lenkrad', 'Sportlenkrad mit Display und Schaltwippen', 550, 9, '🎯'),
    (rennwagen_id, 'Spoilerpaket', 'Heckflügel und Frontsplitter für maximalen Abtrieb', 550, 10, '🏁')
  ON CONFLICT DO NOTHING;
END $$;

-- 6d. Ersatzteile – Raumschiff (12 Teile, Summe ~11.200 Coins)
DO $$
DECLARE
  raumschiff_id BIGINT;
BEGIN
  SELECT id INTO raumschiff_id FROM public.projects WHERE slug = 'raumschiff';
  INSERT INTO public.project_parts (project_id, name, description, coin_cost, sort_order, icon) VALUES
    (raumschiff_id, 'Ionen-Triebwerk', 'Hauptantrieb für interstellare Reisen – Warp-fähig', 2000, 1, '🚀'),
    (raumschiff_id, 'Navigationscomputer', 'Quanten-Navigationssystem mit Sternenkarten', 1500, 2, '🖥️'),
    (raumschiff_id, 'Rumpfpanzerung', 'Titan-Legierung – hält Mikrometeoriten stand', 1200, 3, '🛡️'),
    (raumschiff_id, 'Lebenserhaltung', 'Sauerstoff-Recycler und Klimaanlage für Langzeitmissionen', 1000, 4, '🌱'),
    (raumschiff_id, 'Energiekern', 'Fusionsreaktor – saubere Energie für Jahrhunderte', 1800, 5, '⚡'),
    (raumschiff_id, 'Kommunikationsarray', 'Subraum-Relais für galaktische Kommunikation', 800, 6, '📡'),
    (raumschiff_id, 'Schildgenerator', 'Deflektorschild gegen Asteroiden und feindliche Schiffe', 1100, 7, '🔮'),
    (raumschiff_id, 'Andockschleuse', 'Universelle Luftschleuse für Raumstationen', 500, 8, '🚪'),
    (raumschiff_id, 'Wissenschaftslabor', 'Bordlabor für extraterrestrische Analysen', 600, 9, '🔬'),
    (raumschiff_id, 'Crew-Quartiere', 'Schlafkabinen für bis zu 4 Besatzungsmitglieder', 400, 10, '🛏️'),
    (raumschiff_id, 'Laderaum', 'Großraumfrachtraum für Handelsgüter', 300, 11, '📦'),
    (raumschiff_id, 'Astrometrie-Sensoren', 'Präzise Sensoren für Navigation und Forschung', 500, 12, '🎯')
  ON CONFLICT DO NOTHING;
END $$;

-- 6e. Ersatzteile – Märchenschloss (15 Teile, Summe ~10.700 Coins)
DO $$
DECLARE
  schloss_id BIGINT;
BEGIN
  SELECT id INTO schloss_id FROM public.projects WHERE slug = 'maerchenschloss';
  INSERT INTO public.project_parts (project_id, name, description, coin_cost, sort_order, icon) VALUES
    (schloss_id, 'Grundmauern', 'Massive Steinmauern – das Fundament deines Königreichs', 1200, 1, '🧱'),
    (schloss_id, 'Torturm', 'Wachturm mit Zugbrücke und Fallgitter', 900, 2, '🏛️'),
    (schloss_id, 'Thronsaal', 'Prunkvoller Saal mit Kronleuchter und rotem Teppich', 1000, 3, '👑'),
    (schloss_id, 'Bergfried', 'Höchster Turm – uneinnehmbar und majestätisch', 1100, 4, '🗼'),
    (schloss_id, 'Burgkapelle', 'Gotische Kapelle mit Buntglas-Fenstern', 700, 5, '⛪'),
    (schloss_id, 'Rittersaal', 'Großer Festsaal mit Wappen und Rüstungen', 800, 6, '⚔️'),
    (schloss_id, 'Verlies', 'Tiefe Keller – für Drachen und unliebsame Gäste', 400, 7, '🔒'),
    (schloss_id, 'Schlossküche', 'Großküche für königliche Bankette', 500, 8, '🍖'),
    (schloss_id, 'Bibliothek', 'Turmbibliothek mit tausenden alten Schriftrollen', 600, 9, '📚'),
    (schloss_id, 'Königliche Gemächer', 'Luxuriöse Schlaf- und Wohnräume', 700, 10, '🛏️'),
    (schloss_id, 'Schlossgarten', 'Weitläufiger Garten mit Labyrinth und Springbrunnen', 500, 11, '🌹'),
    (schloss_id, 'Stallungen', 'Platz für 12 edle Pferde und eine Kutsche', 450, 12, '🐴'),
    (schloss_id, 'Waffenkammer', 'Arsenal für die königliche Garde', 550, 13, '🏹'),
    (schloss_id, 'Astronomieturm', 'Aussichtsturm mit Teleskop zur Sternenbeobachtung', 450, 14, '🔭'),
    (schloss_id, 'Geheimgang', 'Versteckter Fluchttunnel – für alle Fälle', 350, 15, '🕳️')
  ON CONFLICT DO NOTHING;
END $$;

-- 6f. Arbeiter-Typen
INSERT INTO public.worker_types (name, description, base_speed, min_pay, max_pay, icon) VALUES
  ('Lehrling', 'Lernt noch – braucht Zeit, ist aber günstig.', 120, 5, 5, '🧑‍🎓'),
  ('Geselle', 'Solide Arbeit zu fairem Preis.', 80, 15, 15, '👨‍🔧'),
  ('Meister', 'Jahrzehnte Erfahrung – schnell und präzise.', 40, 40, 40, '👨‍🏭'),
  ('Ingenieur', 'Hightech-Spezialist mit modernsten Methoden.', 20, 70, 70, '👨‍💻'),
  ('Magier', 'Zeit ist eine Illusion. Extrem schnell, aber sehr teuer.', 1, 1200, 1200, '🧙‍♂️')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  base_speed = EXCLUDED.base_speed,
  min_pay = EXCLUDED.min_pay,
  max_pay = EXCLUDED.max_pay,
  icon = EXCLUDED.icon;

-- 6g. Ein paar tägliche Challenges anlegen
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jeder kann Challenges lesen" ON public.daily_challenges;
CREATE POLICY "Jeder kann Challenges lesen"
  ON public.daily_challenges FOR SELECT
  USING (true);

INSERT INTO public.daily_challenges (challenge_date, game_slug, goal_type, goal_value, reward_coins, description) VALUES
  (CURRENT_DATE, 'flappy-clone', 'score', 20, 30, 'Erreiche 20 Punkte in Flappy Rocket'),
  (CURRENT_DATE, 'street-racer', 'score', 1000, 40, 'Erreiche 1000 Punkte in Street Racer'),
  (CURRENT_DATE, 'alien-invasion', 'score', 15, 35, 'Erwische 15 Aliens in Alien Invasion'),
  (CURRENT_DATE, 'flappy-clone', 'plays', 3, 25, 'Spiele Flappy Rocket 3 Mal'),
  (CURRENT_DATE, 'alien-invasion', 'plays', 3, 25, 'Spiele Alien Invasion 3 Mal')
ON CONFLICT (challenge_date, game_slug, goal_type, goal_value) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. REALTIME & INDIZES
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'highscores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.highscores;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'active_crafts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.active_crafts;
  END IF;
END $$;

-- Score-Aggregations-Trigger (optional, für Phase 2)
-- CREATE OR REPLACE FUNCTION public.aggregate_user_scores()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   UPDATE public.profiles
--   SET total_score = (SELECT COALESCE(SUM(score), 0) FROM public.highscores WHERE user_id = NEW.user_id),
--       games_played = (SELECT COUNT(*) FROM public.highscores WHERE user_id = NEW.user_id)
--   WHERE id = NEW.user_id;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- Automatische Wallet-Belohnung für Highscores (10% vom Score als Coins)
CREATE OR REPLACE FUNCTION public.reward_highscore_coins()
RETURNS TRIGGER AS $$
DECLARE
  coin_reward INTEGER;
  current_balance INTEGER;
BEGIN
  -- 5% des Scores als Coins (mindestens 1, maximal 100)
  coin_reward := GREATEST(1, LEAST(100, FLOOR(NEW.score * 0.05)));
  
  SELECT balance INTO current_balance FROM public.user_wallets WHERE user_id = NEW.user_id;
  
  UPDATE public.user_wallets
  SET balance = balance + coin_reward,
      total_earned = total_earned + coin_reward,
      updated_at = now()
  WHERE user_id = NEW.user_id;
  
  INSERT INTO public.transactions (user_id, amount, type, description, reference_id, balance_after)
  VALUES (NEW.user_id, coin_reward, 'game_win', 'Coins für ' || NEW.score || ' Punkte in ' || NEW.game_slug, NEW.game_slug, current_balance + coin_reward);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS reward_coins_on_highscore ON public.highscores;
CREATE TRIGGER reward_coins_on_highscore
  AFTER INSERT ON public.highscores
  FOR EACH ROW EXECUTE FUNCTION public.reward_highscore_coins();