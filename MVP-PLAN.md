# 🚀 MVP-Plan: SpieleHub

> **Status:** Phase 1 abgeschlossen – Grundgerüst steht.  
> **Ziel:** Mobile-first Spieleplattform mit Auth, Highscores & ersten Minispielen.

---

## ✅ Phase 1 – Foundation (aktueller Stand)

- [x] Next.js 16 App Router mit TypeScript + Tailwind CSS
- [x] Supabase Auth (Login, Registrierung, Callback, Middleware)
- [x] Supabase Client & Server Utilities (`@supabase/ssr`)
- [x] Globaler Zustand (Zustand Store für Auth)
- [x] Datenbank-Schema mit Row-Level-Security (`supabase-schema.sql`)
- [x] Profiles-Tabelle mit Auto-Create-Trigger
- [x] Highscores-Tabelle mit Performance-Indexes
- [x] Realtime-Subscription auf der Leaderboard-Seite
- [x] **Flappy Rocket** – Phaser 3 Minispiel voll integriert
- [x] Kern-Pages: Home, `/games/[slug]`, `/leaderboard`, `/profile`
- [x] UI-Komponenten: Navbar (responsive), GameCard, LeaderboardTable, AuthForm
- [x] `.env.local.example` für Supabase Konfiguration

### Wie du startest:

```bash
# 1. Supabase-Projekt anlegen unter https://supabase.com
# 2. .env.local.example → .env.local kopieren und Werte eintragen
cp .env.local.example .env.local

# 3. supabase-schema.sql im Supabase SQL Editor ausführen

# 4. Dev-Server starten
npm run dev
```

---

## ✅ Phase 2 – Monetarisierung & Crafting (abgeschlossen)

- [x] **Coin-System**: `user_wallets`, `transactions` (Audit-Trail)
- [x] **Coin-Pakete**: Shop unter `/shop` – 5 Preisstufen (2,99€–99,99€)
- [x] **Coin-Shop-Seite**: Paket-Übersicht, Kauf-Flow (simuliert, später Stripe)
- [x] **Balance-Display**: Coin-Guthaben in der Navbar (immer sichtbar)
- [x] **Bauprojekt-System**: Rennwagen, Raumschiff, Märchenschloss
- [x] **Ersatzteile**: 10–15 Teile pro Projekt, Einzelpreise gestaffelt
- [x] **Arbeiter-System**: 5 Typen (Lehrling→Magier), Lohn-Slider = Zeit/Kosten-Tradeoff
- [x] **Werkstatt-Seite**: `/werkstatt` mit Fortschrittsbalken pro Projekt
- [x] **Projekt-Detailseite**: `/werkstatt/[slug]` – Kauf & Bau-Management
- [x] **Game Result Banner**: Coin-Belohnung (5% des Scores) nach jedem Spiel
- [x] **Daily Rewards**: 7-Tage-Streak mit steigenden Belohnungen (10–50 Coins)
- [x] **Erweiterte Profilseite**: Inventar, Transaktionshistorie, fertige Projekte
- [x] **DB-Trigger**: `reward_highscore_coins()` schreibt Coins nach Highscore gut
- [x] **Wallet-Store**: Zustand für Balance-Management

### 💰 Versteckte Kosten-Analyse

| Projekt | Teile | Teilekosten | Arbeiter min | Arbeiter max | Gesamt min | Gesamt max |
|---------|-------|------------|-------------|-------------|-----------|-----------|
| 🏎️ Rennwagen | 10 | 10.850 | ~100 | ~3.000 | ~50 € | ~380 € |
| 🚀 Raumschiff | 12 | 11.200 | ~120 | ~3.600 | ~55 € | ~420 € |
| 🏰 Märchenschloss | 15 | 10.700 | ~150 | ~4.500 | ~50 € | ~460 € |

> **Kombinierte Kosten aller 3 Projekte:** ~150 € (günstigste Arbeiter) bis ~1.260 € (Magier).
> Der Sweetspot für ~500 € pro Projekt: Nutzer wählen Meister/Ingenieur (mittlerer Lohn).

---

## 🔜 Phase 3 – Weitere Spiele & Features

- **Snake** (Phaser 3, Touch-Steuerung)
- **Memory / Match-3** (Phaser oder React-basiert)
- **Multiplayer-Lobby** – Supabase Realtime Presence (`supabase.channel().on('presence')`)
- **Tägliche Challenges** – Supabase Scheduled Functions (`pg_cron`)
- **Achievements / Badges** – Entität + Trigger-System
- **PWA Support** – `next-pwa` für Install-to-Home-Screen
- **i18n** – Mehrsprachig (de/en)

---

## 🧱 Architektur-Übersicht

```
spiele-app/
├── src/
│   ├── app/                    # Next.js App Router Pages
│   │   ├── (auth)/             # Auth-Routes (Login, Register, Callback)
│   │   ├── games/[slug]/       # Spiel-Detailseite
│   │   ├── leaderboard/        # Realtime-Rangliste
│   │   └── profile/            # Benutzerprofil
│   ├── components/             # Wiederverwendbare UI-Komponenten
│   ├── games/                  # Phaser-Spiele (pro Spiel ein Ordner)
│   ├── lib/
│   │   ├── supabase/           # Client, Server, Middleware
│   │   ├── games-registry.ts   # Spiel-Metadaten
│   │   └── store.ts            # Zustand Auth-Store
│   └── types/                  # TypeScript Interfaces
├── supabase-schema.sql         # DB-Schema + RLS
├── .env.local.example          # Umgebungsvariablen Vorlage
└── MVP-PLAN.md                 # Diese Datei
```

---

## 🔐 Supabase RLS Policies (Zusammenfassung)

| Tabelle | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| `profiles` | Alle ✅ | Nur eigener ✅ | Nur eigener ✅ | ❌ |
| `highscores` | Alle ✅ | Nur eigener ✅ | ❌ | ❌ |

- `auth.users` → Trigger `handle_new_user()` legt automatisch ein Profil an
- Realtime: Nur auf `highscores` aktiviert (Publication `supabase_realtime`)

---

## 📝 Nächste Schritte für den Launch

1. `.env.local` mit echten Supabase Keys befüllen
2. Schema im SQL Editor ausführen
3. `npm run dev` – erste Spiele testen
4. Deployment: Vercel (`next build && next start` ready)
5. Custom Domain + Supabase Projekt auf Produktion skalieren