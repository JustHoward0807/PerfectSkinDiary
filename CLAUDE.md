# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@DESIGN.md

## Commands

```bash
npm install          # install dependencies
npx expo start       # start dev server (press i for iOS, a for Android)
expo start --ios     # iOS simulator directly
expo start --android # Android emulator directly
```

No lint or test scripts are configured yet.

## Architecture

**PerfectSkinDiary** is a React Native (Expo) app for AI-powered skin tracking, built for AI DevSummit 2026 (Perfect Corp challenge). The app is currently scaffolded — `App.tsx` is the bare Expo entry point.

### Planned stack (implement per README)

- **React Native + Expo** with `expo-router` for navigation, TypeScript throughout
- **React Native StyleSheet** for styling
- **Supabase** — PostgreSQL DB, Storage (photos/goal images), Auth, Edge Functions (Deno) as secure API proxy
- **Claude API** (`claude-haiku-4-5-20251001`) for plain-language skin analysis summaries
- **Perfect Corp APIs** (proxied through Supabase Edge Functions):
  - `AI-Skin-Analysis` HD — daily 16-metric skin scores
  - `AI-Skin-Simulation` — Day 1 goal image generation
  - `AI-Skin-Tone-Analysis` — onboarding Fitzpatrick type

### Platform-specific UI split

Components use `.ios.tsx` / `.android.tsx` suffixes — Metro picks the correct file automatically. No `Platform.OS` checks in the component layer.

- **iOS**: Liquid Glass design (iOS 26), `expo-blur` BlurView
- **Android**: React Native StyleSheet + DESIGN.md palette

```
components/
  Card/
    Card.ios.tsx
    Card.android.tsx
    Card.types.ts    ← shared Props interface
```

### Security model

The RN client holds only the Supabase public anon key. All calls to YouCam and Claude go through **Supabase Edge Functions** which hold secrets server-side. Never put `YOUCAM_API_KEY` or `ANTHROPIC_API_KEY` in the app bundle.

```
App (anon key) → Supabase Edge Functions → Perfect Corp / Claude APIs
```

### Key DB constraints

- `entries` table has `UNIQUE(issue_id, entry_date)` — enforces one photo per day per track at the DB level (the UI also disables the button, but the constraint is the safety net)
- `issues.goal_image_url` is written once on Day 1 and never updated — treat it as immutable

### Data flow for a new entry

1. Upload selfie → Supabase Storage
2. Edge Function → Perfect Corp `AI-Skin-Analysis` → scores JSON
3. Compute delta vs previous entry's `analysis_scores`
4. Edge Function → Claude with scores + delta + AM/PM routine → `llm_summary`
5. Insert `entries` row with all fields

### PDF export ordering

Selected entries must be sorted by `entry_date` ascending before PDF generation — dermatologist needs chronological order regardless of the user's tap sequence.

### Environment variables

App `.env` (safe to commit structure, not values):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_KEY=
```

Edge Function secrets (Supabase dashboard only):
```
YOUCAM_API_KEY=
ANTHROPIC_API_KEY=
```

## Database Schema

```sql
-- Issues (Tracks): each skin tracking folder
CREATE TABLE issues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  target_concerns  JSONB NOT NULL,    -- ["wrinkle", "pores", "redness", ...]
  goal_image_url   TEXT,              -- Supabase Storage URL — set on Day 1, locked forever
  baseline_scores  JSONB,             -- Day 1 AI-Skin-Analysis scores
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Entries: one per day per track
CREATE TABLE entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id        UUID REFERENCES issues NOT NULL,
  user_id         UUID REFERENCES auth.users NOT NULL,
  entry_date      DATE NOT NULL,
  photo_url       TEXT NOT NULL,        -- Supabase Storage URL (original photo)
  mask_urls       JSONB,                -- YouCam mask overlay URLs per metric
  analysis_scores JSONB NOT NULL,       -- Full YouCam HD score response
  delta_scores    JSONB,                -- Diff vs previous entry (null on Day 1)
  am_routine      JSONB,                -- [{ product: "Vitamin C Serum", brand: "..." }]
  pm_routine      JSONB,                -- [{ product: "Azelaic Acid 10%", brand: "..." }]
  llm_summary     TEXT,                 -- Claude plain-language interpretation
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(issue_id, entry_date)          -- Enforces 1 entry per day per issue
);

-- Personal product library for quick routine logging
CREATE TABLE products (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES auth.users NOT NULL,
  name      TEXT NOT NULL,
  brand     TEXT,
  category  TEXT                        -- "serum", "spf", "moisturiser", etc.
);
```
