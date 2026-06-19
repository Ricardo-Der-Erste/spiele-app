-- ============================================================================
-- reset_all.sql – Alle Spielstände zurücksetzen (nicht das Schema!)
-- ============================================================================
-- Löscht alle Nutzer-Daten, behält aber Tabellen, Seed-Daten und auth.users.
-- Nur im Supabase SQL Editor ausführen.
-- ============================================================================

-- Benutzer-Daten löschen (Reihenfolge beachten: abhängige zuerst)
DELETE FROM public.user_challenges;
DELETE FROM public.daily_rewards;
DELETE FROM public.user_projects;
DELETE FROM public.active_crafts;
DELETE FROM public.user_inventory;
DELETE FROM public.transactions;
DELETE FROM public.user_wallets;
DELETE FROM public.highscores;

-- Profiles zurücksetzen (Scores auf 0)
UPDATE public.profiles SET total_score = 0, games_played = 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- FERTIG – Alle Spielstände gelöscht. Schema und Seed-Daten intakt.
-- ═══════════════════════════════════════════════════════════════════════════