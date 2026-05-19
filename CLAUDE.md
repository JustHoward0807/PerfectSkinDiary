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
| `CameraModal` | Full-screen selfie modal (capture → preview → confirm/retake); iOS uses BlurView bottom bar, Android uses dark View; calls `onConfirm(uri)` with a horizontally-flipped JPEG URI |

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
  "hd_acne":    { "whole": { "raw_score": 64.3, "ui_score": 79 }, "output_mask_name": "hd_acne_output.png" },
  "skin_age": 33,
  "resize_image": { "image_name": "resize_image.jpg" }
}
```

Use `all.score` for the overall skin score — **do not average individual metric `ui_score` values**.

### Mask upload and storage

`runSkinAnalysis(photoUri, userId, issueId, date)` requires all four arguments — `userId`, `issueId`, and `date` are needed to build the Supabase Storage path before uploading masks.

Analysis tasks are created with `enable_mask_overlay: false`. This returns 24 individual PNG mask files in the result ZIP (one per skin concern/region), each referenced by its own `output_mask_name` key in `score_info.json`. During `extractScoreInfoFromZip`, every `output_mask_name` key is found via recursive traversal; the referenced file is uploaded to the `photos` bucket at `${userId}/${issueId}/${date}/Masks/${filename}`, and the value is replaced in-place with the resulting Supabase public URL before the JSON is stored as `analysis_scores`. No separate `mask_urls` column is populated — the URLs live embedded in the `analysis_scores` JSONB. (Setting `enable_mask_overlay: true` would return a single pre-blended image instead of individual masks — do not use that.)

### New-track (Day 1) issue creation order

`generating.tsx` creates the issue **before** running analysis — with `baselineScores: null` and `goalImageUrl: ''` — to obtain a real `issueId` for use in mask Storage paths. After both `runSkinAnalysis` and `runSkinSimulation` complete and images are uploaded, a single `UPDATE` patches both `baseline_scores` and `goal_image_url` together. Do not revert to the old order (analysis first, create issue second) — mask uploads would fail with `undefined` path segments, violating the Storage RLS policy.

### Date handling — always use device local time

**Never** use `new Date().toISOString().split('T')[0]` to get today's date — `toISOString()` returns UTC, which is off by one day for US timezones (UTC-7/UTC-8) when it's past UTC midnight.

```ts
// ✅ Correct — reads device local clock
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```

**Never** use `new Date(isoDateString)` to parse a `YYYY-MM-DD` string from the DB — JavaScript treats date-only strings as UTC midnight, which shifts the displayed date by a day in any non-UTC timezone. Use the `parseLocalDate` helper that exists in each file that needs it:

```ts
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight, not UTC
}
```

`TIMESTAMPTZ` strings from Supabase (e.g. `created_at`) include timezone info and are safe to pass directly to `new Date()`.

### Add Today's Entry flow

The FAB in TrackDetail opens `CameraModal`. On photo confirm, TrackDetail navigates to `app/issue/[id]/entry/analyzing.tsx` (passing `photoUri` as a route param). That screen runs `runSkinAnalysis` → `uploadEntryPhoto` → `createEntry`, then does `router.replace('/issue/${id}/entry/${entryId}')` so the back stack returns to TrackDetail (not the analyzing screen).

`uploadEntryPhoto(localUri, userId, issueId, date)` in `storage.ts` stores to `${userId}/${issueId}/${date}.jpg` with `upsert: true` — separate from the Day 1 `uploadPhoto` path (`selfie.jpg`, `upsert: false`).

`createEntry` in `issueService.ts` inserts with `delta_scores: null`; delta computation is not yet implemented.

TrackDetail re-fetches entries via `useFocusEffect` (skipping the first mount to preserve the prefetch optimisation).

### Back navigation from TrackDetail

TrackDetail uses `router.dismissAll()` for its back button, **not** `router.back()` or `router.replace('/')`. This is intentional: the screen can be reached either directly from HomeScreen or via the generating flow (HomeScreen → AddNewTrack → Generating → replace → TrackDetail), and `dismissAll()` correctly pops everything back to the tabs root with a standard left-to-right pop animation in both cases.

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

-- Products used for a specific issue/track
CREATE TABLE products (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id  UUID REFERENCES issues NOT NULL,
  name      TEXT NOT NULL,
  brand     TEXT,
  category  TEXT                        -- "serum", "spf", "moisturiser", etc.
);
```
