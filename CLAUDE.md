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
| `Header` | Screen header with back button; handles `top` safe area inset internally. Accepts optional `trailing?: ReactNode` rendered in the right slot (replaces the spacer) |
| `PrimaryButton` | Full-width CTA; accepts `label`, `icon` (Ionicons name), `disabled` |
| `FormInput` | Labelled text field |
| `Chip` | Selectable tag with haptic feedback on press |
| `SectionCard` | Container card (BlurView on iOS, `surfaceVariant` View on Android) |
| `CameraModal` | Full-screen selfie modal (capture → preview → confirm/retake); iOS uses BlurView bottom bar, Android uses dark View; calls `onConfirm(uri)` with a horizontally-flipped JPEG URI |
| `EmailGateSheet` | Bottom sheet modal for anonymous→permanent account upgrade; iOS: BlurView + Apple Sign-In button (primary) + Google button; Android: Google button only; props: `{ visible, onLinked, onDismiss }` |

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

### One new track per day limit

Users can only create **one new skin track per day**. The guard runs at the very top of `run()` in `app/new-issue/generating.tsx`, before the coin gate, so neither a coin nor a DB row is consumed when the limit is already hit.

`hasCreatedTrackToday(userId)` in `issueService.ts` queries `issues` for rows with `created_at >= local midnight today` (converted to UTC ISO for the TIMESTAMPTZ comparison). Returns `true` if count ≥ 1. Fails open on Supabase error so a transient network issue doesn't block the user.

```ts
// Local midnight → UTC ISO for TIMESTAMPTZ comparison
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
```

The limit resets at local midnight (same convention as all other date logic in the app).

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

Storage paths in `storage.ts`:

| Function | Path | Notes |
|---|---|---|
| `uploadPhoto(uri, userId, issueId, date)` | `${userId}/${issueId}/${date}/selfie.jpg` | Day 1 only, `upsert: false` |
| `uploadEntryPhoto(uri, userId, issueId, date)` | `${userId}/${issueId}/${date}/${date}.jpg` | Subsequent entries, `upsert: true` |
| `uploadGoalImage(url, userId, issueId)` | `${userId}/${issueId}/goal.jpg` | Issue-scoped (not date-scoped), `upsert: false` |

Both Day 1 and subsequent entry photos live under their date folder — this makes per-entry storage deletion straightforward by listing and removing `${userId}/${issueId}/${date}/`.

`createEntry` in `issueService.ts` inserts with `delta_scores: null`; delta computation is not yet implemented.

TrackDetail re-fetches entries via `useFocusEffect` (skipping the first mount to preserve the prefetch optimisation). HomeScreen also uses `useFocusEffect` (skip-first-mount) to invalidate its `_cache` and re-fetch the issue list whenever the screen regains focus — this keeps the list correct after a track deletion.

### Deleting tracks and entries

**Delete track** — `deleteIssueAndEntries(issueId)` in `issueService.ts`:
1. Fetches `user_id` from the issue row
2. Calls the private `deleteStorageFolder(prefix)` helper to recursively list and remove every file under `${userId}/${issueId}/` (photos, masks, goal image) — best-effort, non-fatal
3. Deletes all `entries` rows for the issue, then the `issues` row

**Delete entry** — `deleteEntry(entryId, photoUrl)` in `issueService.ts`:
1. Extracts the storage folder prefix from `photoUrl` (everything before the last `/` after `/object/public/photos/`)
2. Calls `deleteStorageFolder` on that date folder (removes the photo + all mask PNGs) — best-effort
3. Deletes the `entries` row

**Day 1 protection** — TrackDetail passes `isDay1='1'` as a route param when navigating to the first entry (`entries[0]`, ascending sort). EntryDetail hides the delete button when `isDay1 === '1'`. The Day 1 entry is only removed as part of a full track deletion.

`deleteStorageFolder(prefix)` is a module-private recursive async function in `issueService.ts`. It calls `supabase.storage.from('photos').list(prefix)`, splits results into files (`item.id !== null`) and subfolders (`item.id === null`), removes files in bulk, then recurses into subfolders.

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

### interpret Edge Function — dual-mode API

`supabase/functions/interpret/index.ts` handles two distinct request shapes:

| Mode | Request body | Response |
|---|---|---|
| Single-entry | `{ scores: Record<string, unknown>, products: [...] }` | `{ summary: string }` — 3-sentence current-state summary |
| Trend (multi-entry) | `{ entries: [{ date, scores }, ...], products: [...] }` | `{ bullets: string[] }` — 4 one-sentence trend insights |

Detection: `Array.isArray(body.entries) && body.entries.length > 0` routes to trend mode; everything else falls through to single-entry mode. Both modes are backward-compatible — do not remove the single-entry branch; it is used by the per-entry LLM summary flow.

**Web search** — the `web_search_20250305` tool is conditionally passed to the Claude API only when `products.length > 0`. This lets Claude look up product ingredient info for richer insights without incurring search costs on empty routines. The response `content` array may contain `tool_use`/`tool_result` blocks before the final `text` block; always extract the text block with `.find(b => b.type === 'text')`, never `content[0].text`.

**Product type** — `products` items are `{ name: string; routine: 'am' | 'pm' }`. The `brand` and `category` fields were removed from the schema.

### Bottom safe area pattern

Tab screens must account for the native tab bar in their scroll content. Apply this to every tab screen's `contentContainerStyle`:

```ts
contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 60 }]}
```

Remove any hardcoded `paddingBottom` from the static `content` style — the inline value replaces it. On Android, also render a background-coloured spacer View below the ScrollView to fill the system navigation bar area:

```tsx
{Platform.OS === 'android' && insets.bottom > 0 && (
  <View style={{ height: insets.bottom, backgroundColor: Colors.surface }} />
)}
```

### Anonymous → social sign-in linking

`src/hooks/useAuthLink.ts` — both `signInWithGoogle` and `signInWithApple` check `user.is_anonymous` before calling the auth method:

- **Anonymous user** → `(supabase.auth.linkIdentity as any)({ provider, token: idToken })` — links the Google/Apple identity to the existing anonymous account, **preserving the UID** and all associated data (issues, entries, wallet)
- **Non-anonymous user** → `supabase.auth.signInWithIdToken({ provider, token })` — standard sign-in

The `as any` cast is required because the JS SDK types for `linkIdentity` only describe the web OAuth redirect overload; the native token overload `{ provider, token }` works at runtime in v2.x but isn't in the TypeScript types yet.

**Prerequisite**: "Manual Linking" must be enabled in Supabase Dashboard → Authentication → Configuration. Without it `linkIdentity` returns an error regardless of the token.

### Delete account

`deleteUserAccount()` in `src/services/supabase/accountService.ts`:
1. Deletes all Storage files under `${userId}/` client-side (SQL functions cannot reach Storage buckets)
2. Calls `supabase.rpc('delete_user_account')` — a `SECURITY DEFINER` SQL function that deletes `entries` → `issues` (products cascade) → `auth.users` row (wallet + coin_transactions cascade)
3. Calls `supabase.auth.signOut()` to clear the now-invalid local session
4. Calls `supabase.auth.signInAnonymously()` to provision a fresh anonymous account

The SQL function was applied via migration `delete_user_account_function`. It runs as the postgres role (permission to `DELETE FROM auth.users`). Only the `authenticated` role can call it — anonymous users are excluded. SettingsScreen closes the modal and resets state on success; `useAuth`'s `onAuthStateChange` then re-renders the screen automatically showing the new anonymous state.

### Google Sign-In — lazy require pattern

`@react-native-google-signin/google-signin` is a native module that **crashes at import time in Expo Go**. The crash propagates through `EmailGateSheet` → `ui/index.ts` → every screen that imports any UI primitive, taking down all routes.

Fix: use lazy `require()` inside a function body, never a top-level `import`:

```ts
// src/hooks/useAuthLink.ts
function getGoogleModule() {
  return require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
}
```

This defers the crash to the moment the user taps "Continue with Google", where it surfaces as a graceful `Alert` instead of breaking the whole app. Do not change this to a top-level import.

### react-native-iap v15 field name changes

In v15 (NitroModules), the `Product` type changed on both iOS and Android (`ProductCommon`):

| v14 and below | v15+ |
|---|---|
| `product.productId` | `product.id` |
| `product.localizedPrice` | `product.displayPrice` |

On iOS, `fetchProducts` takes `{ skus: string[] }` with **no `type` parameter** — `type` is Android-only (`'in-app'` or `'subs'`). Passing `type: 'in-app'` on iOS causes StoreKit to return 0 products.

### Auth hooks

**`useAuth`** (`src/hooks/useAuth.ts`) — thin wrapper around `supabase.auth.getUser()` + `onAuthStateChange`. Returns `{ user }`. Used by SettingsScreen to read `user.is_anonymous`, `user.user_metadata.full_name`, and `user.email`.

**`useWallet`** (`src/hooks/useWallet.ts`) — fetches the user's wallet row and computes trial status from `user.created_at`. Returns:
```ts
{
  balance: number | null   // null until loaded
  isInTrial: boolean       // true if < 2 days since account creation
  trialDaysLeft: number
  loading: boolean
  refresh: () => Promise<void>
}
```
Trial is display-only. The authoritative check always happens server-side in the `check-and-deduct` Edge Function.

### Wallet service and coin gate

**`src/services/supabase/walletService.ts`** — client-side calls to the three wallet Edge Functions:
- `checkAndDeduct(issueId?)` — called before every analysis; returns `{ allowed, reason, remaining_balance, trial_days_left }`
- `validatePurchase({ platform, transactionId, receipt, productId })` — called after IAP purchase completes
- `redeemCode(code)` — called from Wallet screen redeem input; returns `{ coins_added, new_balance }`
- `fetchWallet()` / `fetchCoinPackages()` — read-only queries used by `useWallet` and WalletScreen

**Coin gate** — `checkAndDeduct()` is called at the very top of `run()` in both analysis screens, before any issue or entry row is created:
- `app/new-issue/generating.tsx` — gates Day 1 analysis + simulation
- `app/issue/[id]/entry/analyzing.tsx` — gates subsequent entries

If `allowed === false`, an `Alert` is shown with a "Buy Coins" button that navigates to `/wallet`, and `run()` returns early without creating any DB rows or calling any API. The coin is deducted before the API call — if the API subsequently fails, the coin is still spent (accepted trade-off to avoid server-side analysis state tracking).

**`app/wallet.tsx`** — route entry point; just re-exports `WalletScreen` from `src/components/Wallet/WalletScreen`.

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
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=    # Google OAuth web client ID (from Google Cloud Console)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=    # Google OAuth iOS client ID (for native sign-in flow)
```

Edge Function secrets (Supabase dashboard only):
```
YOUCAM_API_KEY=
ANTHROPIC_API_KEY=
APPLE_SHARED_SECRET=        # App Store Connect → In-App Purchases → App-Specific Shared Secret
GOOGLE_SERVICE_ACCOUNT_JSON= # Google Play Console → Setup → API access → service account JSON
ANDROID_PACKAGE_NAME=       # e.g. com.perfectskindiary.app
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
  llm_summary     TEXT,                 -- Claude plain-language interpretation
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(issue_id, entry_date)          -- Enforces 1 entry per day per issue
);

-- AM/PM skincare products for a specific track
-- Deleted automatically via ON DELETE CASCADE when the parent issue is deleted
CREATE TABLE products (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id  UUID REFERENCES issues(id) ON DELETE CASCADE NOT NULL,
  name      TEXT NOT NULL,
  routine   TEXT NOT NULL CHECK (routine IN ('am', 'pm'))
);

-- Coin wallet — one row per user. Balance is NEVER written by the client (no INSERT/UPDATE RLS policy).
-- All writes go through Edge Functions using the service_role key.
-- Trigger create_wallet_for_new_user() auto-creates this row on every new signup (anonymous or email).
CREATE TABLE wallets (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coin_balance  INTEGER NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS: authenticated users may SELECT their own row only. No client writes.

-- IAP packages — configurable from Supabase dashboard with no app update.
-- coin_amount, bonus_coins, badge, sort_order, is_active can all change freely.
-- USD prices are set in App Store Connect / Google Play Console and fetched at
-- runtime by react-native-iap; they are NOT stored here.
CREATE TABLE coin_packages (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id             TEXT    NOT NULL UNIQUE,   -- matches App Store / Play Console SKU
  display_name           TEXT    NOT NULL,
  coin_amount            INTEGER NOT NULL CHECK (coin_amount > 0),
  bonus_coins            INTEGER NOT NULL DEFAULT 0,
  badge                  TEXT,                      -- e.g. "Best Value", "Promo: 20% OFF"
  badge_style            TEXT,                      -- "primary" | "tertiary"
  is_featured            BOOLEAN NOT NULL DEFAULT FALSE,
  original_price_display TEXT,                      -- display-only strikethrough e.g. "$11.24"
  sort_order             INTEGER NOT NULL DEFAULT 0,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS: any authenticated user (including anonymous) can SELECT active rows.

-- Promo / redeem codes — admin-only. No client RLS SELECT policy (clients see nothing).
-- All validation happens server-side in the redeem-code Edge Function.
CREATE TABLE redeem_codes (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT    NOT NULL UNIQUE,
  coin_amount   INTEGER NOT NULL CHECK (coin_amount > 0),
  max_uses      INTEGER NOT NULL DEFAULT 1,
  current_uses  INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,   -- NULL = never expires
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS enabled, intentionally no SELECT policy.

-- Immutable audit log. Positive amount = credit, negative = debit.
-- type CHECK: 'purchase' | 'redeem_code' | 'analysis_deduct' | 'trial'
CREATE TABLE coin_transactions (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,
  type          TEXT    NOT NULL,
  reference_id  TEXT,   -- IAP transactionId / issue_id / redeem code string
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS: authenticated users may SELECT their own rows only. No client writes.
```

### Wallet SQL functions (SECURITY DEFINER — service_role only)

All three functions are revoked from `public`, `anon`, and `authenticated`. Only Edge Functions (which use `SUPABASE_SERVICE_ROLE_KEY`) can invoke them.

| Function | Signature | Purpose |
|---|---|---|
| `credit_coins` | `(p_user_id UUID, p_amount INTEGER) → VOID` | Upsert-and-increment wallet balance. Called by `validate-purchase` and `redeem-code` Edge Functions after server-side validation. |
| `deduct_coin_atomic` | `(p_user_id UUID) → TABLE(success BOOLEAN, remaining_balance INTEGER)` | Advisory lock + `FOR UPDATE` prevents double-spend. Called by `check-and-deduct` Edge Function before each analysis. |
| `redeem_code_atomic` | `(p_user_id UUID, p_code TEXT) → JSON` | Validates code rules (active, not expired, under max_uses), increments `current_uses`, and credits coins — all in one serialised transaction. Returns `{ success, error_reason, coins_added, new_balance }`. |

**Trigger**: `on_auth_user_created` fires `AFTER INSERT ON auth.users` and calls `create_wallet_for_new_user()` to auto-create a zero-balance wallet row for every new user (anonymous or email).
