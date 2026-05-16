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

### Design tokens

All colors and border radii live in **`src/theme.ts`** — the single source of truth. Import from there; never hardcode hex values or radius numbers in components.

```ts
import { Colors, IOSColors, Radius } from '../../theme';
// Colors     → Android DESIGN.md palette
// IOSColors  → iOS system semantics (label, background, separator…)
// Radius     → { sm: 8, md: 16, lg: 24, full: 9999 }
```

### Platform-specific UI split

Components use `.ios.tsx` / `.android.tsx` suffixes — Metro picks the correct file automatically. No `Platform.OS` checks in the component layer.

- **iOS**: Liquid Glass design (iOS 26), `expo-blur` BlurView
- **Android**: React Native StyleSheet + DESIGN.md palette (`Colors` from `src/theme.ts`)

Each component folder follows this layout:

```
ComponentName/
  ComponentName.ios.tsx     ← iOS implementation (BlurView + IOSColors)
  ComponentName.android.tsx ← Android implementation (Colors palette)
  ComponentName.types.ts    ← shared Props interface
  ComponentName.d.ts        ← TypeScript stub (no runtime code — Metro resolves the right impl)
```

### UI primitive library

Shared UI primitives live in **`src/components/ui/`** and are re-exported from `src/components/ui/index.ts`. Always use these before building ad-hoc styled elements.

| Component | Purpose |
|---|---|
| `Header` | Screen header with back button; handles `top` safe area inset internally |
| `PrimaryButton` | Full-width CTA; accepts `label`, `icon` (Ionicons name), `disabled` |
| `FormInput` | Labelled text field |
| `Chip` | Selectable tag with haptic feedback on press |
| `SectionCard` | Container card (BlurView on iOS, `surfaceVariant` View on Android) |

Import pattern:

```ts
import { Header, FormInput, Chip, SectionCard, PrimaryButton } from '../ui';
```

To add a new primitive: create the folder under `src/components/ui/`, add `.ios.tsx`, `.android.tsx`, `.types.ts`, `.d.ts`, then export from `index.ts`.

### trackResultStore

`src/services/trackResultStore.ts` passes large API results between the generating screen and TrackDetail without URL-param serialisation. Signature:

```ts
trackResultStore.set(analysis, simulation, trackName, photoUri)
// photoUri — local file URI of the Day 1 selfie
```

All four args are required. Reading: `trackResultStore.get()` returns `{ analysisResult, simulationResult, trackName, photoUri }`.

### score_info.json shape (YouCam analysis)

The YouCam HD analysis ZIP contains `score_info.json` with this shape:

```json
{
  "all": { "score": 77.8 },
  "hd_wrinkle": { "whole": { "raw_score": 86.7, "ui_score": 79 }, "forehead": { ... }, ... },
  "hd_pore":    { "whole": { ... }, "forehead": { ... }, "nose": { ... }, "cheek": { ... } },
  "hd_acne":    { "whole": { "raw_score": 64.3, "ui_score": 79 } },
  "skin_age": 33,
  "resize_image": { "image_name": "resize_image.jpg" }
}
```

Use `all.score` for the overall skin score — **do not average individual metric `ui_score` values**.

### extractGoalImageFromZip

`extractGoalImageFromZip(url)` in `src/services/youcam/youcamApi.ts` handles two cases:

- **ZIP response** (PK magic bytes `0x50 0x4B`) — extracts the first image entry and returns a base64 data URI.
- **Direct image URL** (not a ZIP) — returns the URL as-is; React Native's `Image` loads it natively.

The YouCam simulation API returns a direct image URL, not a ZIP. The analysis API returns a ZIP. Use this function for both.

### Demo mode (API backdoor)

To skip API calls during development, set the track name to `"demo"` (case-insensitive) and select both **Acne** and **Pores** chips before tapping Generate. This:

- Skips the generating screen entirely
- Loads `demo/skinanalysisResult.json` as the analysis result
- Loads `demo/goal.png` as the goal image and `demo/original.png` as the Day 1 photo
- Navigates directly to `/issue/new`

Logic lives in `src/services/demoMode.ts`. Asset files are in `demo/` at the repo root.

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
  am_routine       JSONB,             -- [{ product: "Vitamin C Serum", brand: "..." }]
  pm_routine       JSONB,             -- [{ product: "Azelaic Acid 10%", brand: "..." }]
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
