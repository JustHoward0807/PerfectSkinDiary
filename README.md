# 🧴 PerfectSkinDiary — AI-Powered Skin Tracking App

> Built for **AI DevSummit 2026 Hackathon** · Perfect Corp Challenge

---

## 📖 Overview

PerfectSkinDiary is a mobile app that helps users track their skin condition over time through daily photo journaling. By integrating **Perfect Corp's YouCam API** for clinical-grade skin analysis and **Claude** for human-readable interpretation, users gain meaningful, personalized insights into how their skin changes day by day — correlated with their skincare routine — and can share those records directly with their dermatologist.

On Track creation, a **Goal Image** is generated via AI Skin Simulation — a realistic visualisation of what the user's skin could look like after targeted improvement — giving every tracking journey a clear, motivating destination.

The app also surfaces a lightweight **UV Index + SPF recommendation widget** on the home screen.

---

## 🎯 Purpose

| Goal | Description |
|---|---|
| **Visualise** | Generate a realistic goal skin image on Day 1 so users know what they're working toward |
| **Track** | Log daily skin photos per Track and receive AI-powered analysis scores |
| **Correlate** | Record AM/PM skincare routines alongside each entry to identify which products are working |
| **Compare** | Automatically compare today's results against yesterday's to surface meaningful changes |
| **Understand** | Use Claude to translate raw API scores into plain-language insights |
| **Share** | Export selected entries as a structured report for dermatologist consultations |
| **Protect** | Remind users to apply the right SPF based on today's local UV Index |

---

## ✨ Features

### 📁 Skin Tracks

Users create a **Track** to represent a tracking goal:
- A specific skin concern: *"Chin acne cluster"*, *"Forehead wrinkles"*
- A product trial: *"30 days on Anua Azelaic Acid"*, *"Testing new moisturiser"*
- A general baseline: *"Monthly skin check"*

Each Track has:
- A **locked Goal Image** generated on Day 1 (see below)
- A chronological entry timeline (one photo per day)

**One new track per day** — users can only start one new skin track per day. The limit resets at local midnight. This is enforced in the generating screen before any coin is deducted or DB row created.

---

### 🎯 Goal Image (AI Skin Simulation)

When a user creates a new Track and uploads their **first photo**, the app:

**Step 1 — User selects skin concerns to target:**
```
☑ Wrinkles      ☑ Pores       ☑ Redness
☑ Radiance      ☐ Dark Circles ☑ Texture
☐ Eye Bags      ☑ Oiliness    ☐ Spots
```
If the user skips selection, all concerns are included by default.

**Step 2 — App calls two APIs in parallel:**

| API | Purpose |
|---|---|
| `AI-Skin-Analysis` (HD) | Establishes baseline scores across 16 metrics |
| `AI-Skin-Simulation` | Generates the goal image using selected concerns at **intensity 0.5** (balanced, natural improvement) |

**AI Skin Simulation intensity logic:**
```
No concerns selected (user skips / uses default):
  → ALL 9 concerns set to intensity 0.5

Specific concerns selected:
  → Selected concerns   = 0.5  (natural, realistic improvement)
  → Unselected concerns = 0.0  (no change applied)
```

**Step 3 — Goal Image is locked permanently.**
The generated image is saved to Supabase Storage and attached to the Track. It cannot be regenerated or replaced — it acts as the fixed north-star target for the entire tracking journey.

**What the API does:**
The AI Skin Simulation API (`POST /s2s/v2.0/task/skin-simulation`) takes the Day 1 photo and renders a photorealistic version of the user's face with the selected skin concerns improved to the specified intensity level. At 0.5, results are natural and plausible rather than over-processed.

---

### 🧴 AM / PM Skincare Routine Logging

Each **Track** has a single AM and PM routine — the products the user is running for that specific skin goal:
- **AM Routine**: products applied in the morning (cleanser, vitamin C, SPF, etc.)
- **PM Routine**: products applied at night (toner, actives, moisturiser, etc.)

Routines are set at the Track level (not per daily entry) because a skincare trial is typically consistent over time. Products are scoped to the Track they belong to. Routine data is passed to Claude alongside skin scores for contextual insights:
> *"Your moisture improved 8 points since adding the ceramide serum to your PM routine."*

---

### 📸 Daily Photo Analysis

- User uploads or captures a selfie within a Track
- Photo is sent to **YouCam AI Skin Analysis API (HD mode)**
- Returns scores across 16 skin dimensions with regional breakdowns
- Results displayed as scores + visual mask overlays

**One photo per day enforcement (two-layer):**

| Layer | Mechanism |
|---|---|
| **UI** | On Track Detail screen load, the app queries whether today already has an entry. If yes, the `[+ Add Today's Entry]` button is replaced with a disabled state: *"Already logged today — come back tomorrow"* |
| **Database** | `UNIQUE(issue_id, entry_date)` constraint on the `entries` table hard-rejects any duplicate insert as a safety net |

```typescript
// Build today's date in device local time (never toISOString — that returns UTC)
const d = new Date()
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// alreadyLoggedToday is derived from the entries already fetched for the Track Detail screen
const alreadyLoggedToday = entries.some(e => e.entry_date === today)
```

---

### 📊 Day-over-Day Comparison

- **Day 1:** Baseline — displays analysis results only
- **Day 2+:** Compares against previous entry
  - Delta per metric (`moisture +5 ↑`, `redness -3 ↓`)
  - Highlights most significant changes

---

### 🤖 LLM Interpretation (Claude)

Raw YouCam scores + delta + AM/PM routine → Claude generates a 2–4 sentence actionable summary.

**Why Claude?** Research (medRxiv, 2025) found Claude demonstrated strong epistemic humility in dermatology contexts — expressing appropriate uncertainty rather than hallucinating confident medical claims. No consumer API exists for skincare-specific fine-tuned LLMs (SkinGPT-4, DermGPT are research-only). Claude with a skincare-domain system prompt is the most reliable practical choice.

---

### 📤 Export for Dermatologist

Users select specific entries from a Track (e.g., Monday–Friday of week 1 + the following Thursday) and export as a **PDF** for dermatologist review.

**Chronological ordering is enforced regardless of selection order** — entries are always sorted by `entry_date` ascending (oldest → newest) before PDF generation. This ensures the dermatologist reads the skin progression in the correct chronological direction.

```typescript
// Sort selected entries before building PDF
const sorted = selectedEntries.sort(
  (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
)
```

Each entry in the PDF contains:
1. Date header (e.g., `Monday 5 May 2025`)
2. Original selfie photo
3. AI mask overlay image (heatmap of skin concerns)
4. Full scores per metric
5. Claude-generated plain-language summary

---

### 🔐 Account & Sign-In

The app starts anonymously — no sign-up required. Users are prompted to link their account via **Google Sign-In** (Android + iOS) or **Apple Sign-In** (iOS only) before making their first In-App Purchase. Linking upgrades the anonymous session to a permanent identity without changing the user ID, so all existing coins and tracking data carry over seamlessly.

- Sign-In available from Settings → "Sign In & Secure Account"
- After sign-in, the profile card shows the user's display name / email
- On reinstall, signing in with the same provider restores the existing account and wallet

### 💰 Coin Wallet & In-App Purchases

Each skin analysis costs **1 coin**. New users get a **2-day free trial** (server-enforced) during which analyses are free.

- Coin balance displayed in Settings → "My Wallet" and on the Wallet screen
- Top-up packages configured in Supabase (`coin_packages` table) — amounts and badges update instantly without an app release; prices are fetched live from the App Store / Play Store at runtime
- **Redeem codes** — admin-issued promo codes redeemable from the Wallet screen
- Coin is deducted server-side before each analysis (atomic SQL function, double-spend protected)

### ☀️ UV Index + SPF Widget

- Home screen top-right corner
- UV Index fetched by GPS or manual city input
- Calculates minimum recommended SPF for today
- Daily morning push notification *(planned — not yet implemented)*

---

## 🎨 Design System

See [`DESIGN.md`](./DESIGN.md) for the full design system reference.

- **iOS**: Native Liquid Glass design (iOS 26) — no custom palette, follows system design language
- **Android**: Custom creamy diary palette defined in `DESIGN.md`, implemented via React Native StyleSheet

---

## 🛠 Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | React Native (Expo) |
| Language | TypeScript |
| Navigation | Expo Router |
| Animation | react-native-reanimated |
| Styling | React Native StyleSheet |
| Camera | expo-camera |
| Notifications | expo-notifications *(planned)* |
| Location | expo-location (with manual city fallback) |
| PDF Export | react-native-html-to-pdf |
| In-App Purchase | react-native-iap (iOS StoreKit + Android Billing) |
| Google Sign-In | @react-native-google-signin/google-signin |
| Apple Sign-In | expo-apple-authentication (iOS only) |

**Platform-specific UI** — platform implementations live in dedicated `src/ios/` and `src/android/` source trees. `src/components/` holds thin bridge files (`.ios.tsx` / `.android.tsx`) that re-export from the correct platform folder — Metro dispatches automatically, no runtime `Platform.OS` checks in the component layer.

| Layer | iOS | Android |
|---|---|---|
| Design Language | Liquid Glass (iOS 26) | DESIGN.md warm palette |
| Blur / Glass | `expo-blur` BlurView | — |
| Styling | Custom Liquid Glass components | React Native StyleSheet |
| Background | `#F2F2F7` system gray | `#FDF8F3` warm cream |

**Source tree layout:**
```
src/
  components/
    HomeScreen/
      HomeScreen.ios.tsx        ← iOS implementation (BlurView + Liquid Glass)
      HomeScreen.android.tsx    ← Android implementation (warm DESIGN.md palette)
      HomeScreen.d.ts           ← TypeScript type stub (no runtime code)
  hooks/                        ← shared hooks
  models/                       ← shared data models
  utils/                        ← shared utilities
  services/
    supabase/
      supabase.ts
```

Platform implementations live directly in the component folder, selected automatically by Metro via `.ios.tsx` / `.android.tsx` file extensions. No `Platform.OS` checks needed in the component layer.

### Backend / Services
| Layer | Technology |
|---|---|
| Database | **Supabase** (PostgreSQL) |
| File Storage | Supabase Storage |
| Auth | Supabase Auth (anonymous sign-in on first launch) |
| API Proxy | **Supabase Edge Functions** (Deno) |
| Skin Analysis | Perfect Corp `AI-Skin-Analysis` (HD) |
| Skin Simulation | Perfect Corp `AI-Skin-Simulation` |
| Skin Tone | Perfect Corp `AI-Skin-Tone-Analysis` |
| LLM | Claude API (`claude-haiku-4-5-20251001`) |
| UV Index | Open-Meteo API (free, no key required) |

### Why Supabase?
1. **PostgreSQL** — structured time-series skin data; SQL handles date-range queries cleanly
2. **Built-in Storage** — photo + goal image hosting without a separate S3 setup
3. **Built-in Auth** — user accounts out of the box
4. **Row Level Security** — users can only access their own data, enforced at the DB level
5. **Edge Functions** — Deno serverless functions act as a secure API proxy (see Security)
6. **TypeScript SDK** — matches the project stack
7. **Generous free tier** — sufficient for prototype and early App Store deployment

---

## 🔐 API Key Security (App Store / Play Store)

All sensitive API calls are routed through **Supabase Edge Functions**. The app client only holds Supabase's public anon key.

```
React Native App  (holds only Supabase anon key)
      ↓  Supabase Auth JWT
Supabase Edge Functions  ← YouCam + Claude keys stored as encrypted Supabase Secrets
      ↓                        ↓                    ↓
AI-Skin-Analysis     AI-Skin-Simulation        Claude API
```

---

## 📍 Location (UV Widget)

1. **GPS (auto)** — if user grants location permission
2. **Manual city input** — geocoded via Open-Meteo if permission denied
3. **No location** — widget hidden with prompt to enable

---

## 🔌 API Integrations

### Perfect Corp APIs

| API | Endpoint | Usage |
|---|---|---|
| `AI-Skin-Analysis` (HD) | `POST /s2s/v2.0/task/skin-analysis` | Daily entry: 16 skin metrics with regional breakdowns |
| `AI-Skin-Simulation` | `POST /s2s/v2.0/task/skin-simulation` | Day 1 only: generates locked Goal Image |
| `AI-Skin-Tone-Analysis` | `POST /s2s/v2.0/task/skin-tone-analysis` | One-time onboarding: Fitzpatrick type for SPF personalisation |

**AI Skin Simulation — Concern Parameters:**

| Parameter | Concern |
|---|---|
| `wrinkle` | Fine lines and wrinkles |
| `radiance` | Skin brightness and glow |
| `oiliness` | Excess sebum |
| `eye_bags` | Under-eye puffiness |
| `dark_circles` | Under-eye pigmentation |
| `spots` | Age spots and pigmentation |
| `pores` | Pore visibility |
| `texture` | Skin surface smoothness |
| `redness` | Skin redness and irritation |

**Intensity logic:**
- No concerns selected → all 9 concerns at `0.5`
- Concerns selected → selected at `0.5`, unselected at `0.0`

**HD Skin Analysis — Metrics Tracked Daily:**

| Category | Sub-regions |
|---|---|
| `hd_wrinkle` | whole, forehead, glabellar, crowfeet, periocular, nasolabial, marionette |
| `hd_pore` | whole, forehead, nose, cheek |
| `hd_acne` | whole |
| `hd_moisture` | whole |
| `hd_redness` | whole |
| `hd_oiliness` | whole |
| `hd_texture` | whole |
| `hd_radiance` | whole |
| `hd_firmness` | whole |
| `hd_age_spot` | whole |
| `hd_dark_circle` | under-eye |
| `hd_eye_bag` | under-eye |

---

## 📱 App Flow

```
Tab Bar: Home | Analysis | Settings

Settings Screen
├── Profile card (signed-in users only — shows Google/Apple display name)
├── Sign In & Secure Account (anonymous users only) → EmailGateSheet slide-up
├── My Wallet: X coins → /wallet
├── About App / Terms / Privacy Policy
└── Delete Account

Wallet Screen (/wallet)
├── Current balance card (coin count + trial badge if in trial)
├── Top-up packages (prices fetched live from App Store / Play Store)
│     tap → EmailGateSheet if anonymous, else IAP purchase flow
├── Redeem Code input → redeem-code Edge Function
└── Transaction feedback (Alert on success / error)


Home Screen
├── UV Index Widget (top right) → SPF recommendation
├── Track List
└── [+ New Track]

New Track Setup (Day 1 only)
├── Name the Track
├── Upload first selfie
├── Select skin concerns to target
│   (default = all 10 concerns selected)
└── [Generate Goal] →
      Parallel API calls:
      ① AI-Skin-Analysis → baseline scores (stored in issues.baseline_scores)
      ② AI-Skin-Simulation → goal image (stored in issues.goal_image_url, locked)
      → Track created → navigate to Track Detail Screen

Track Detail Screen  ← per-track hub
├── Goal Image ↔ Day 1 Photo slider
│     slide left  → reveals more Goal Image
│     slide right → reveals more Day 1 photo
├── Current Streak
├── Improvement metrics summary i.e +12% (skin progress since Day 1)
├── AM / PM Routine  ← track-level, edit anytime
├── Claude summary card
├── Entry Timeline (chronological list of past entries)
│     sort toggle (newest-first by default, tap icon to reverse)
│     tap entry → Entry Detail Screen
└── [+ Add Today's Entry]  ← disabled if already logged today
      → opens Add Entry Screen

Add Entry Screen  ← camera / upload flow
├── Take / upload selfie
└── [Analyse] →
      ① check-and-deduct Edge Function (trial check / deduct 1 coin)
         → if insufficient: Alert "Buy Coins" → /wallet
      ② Upload → Edge Function → AI-Skin-Analysis
      ③ Compute delta vs yesterday
      ④ Edge Function → Claude (summary)
      ⑤ Store entry → navigate back to Track Detail Screen

Entry Detail Screen  ← single day result
├── Original photo (that day)
├── Mask overlay (toggle per metric)
├── Score dashboard (all metrics + delta ↑↓)
└── Claude summary

Analysis Screen
├── Day selector: 3 / 5 / 10 days (slices most recent N unique-date entries)
├── Skin Score Trend card
│     LineChart of overall score (all.score) per day
│     Tap / drag → vertical strip pointer with score + date tooltip
│     Animated on mount and on day-selector change
│     Avg. score displayed in card header
├── Skin Concerns grid (2-column)
│     6 common concerns: Moisture, Redness, Pores, Texture, Acne, Oiliness
│     Status label derived from latest entry score (≥80 / 65–79 / <65 tiers)
│     Trend arrow: ↗ improved / ↘ worsened / → stable vs. first displayed entry
│     Score bar proportional to metric value
└── [Export PDF Report] → generates clinical PDF (see PDF export)

Export (via Analysis screen)
└── [Export PDF Report] → share sheet (iOS: in-app viewer + share; Android: system PDF app)
```

---

## 🚀 Getting Started

```bash
npm install
cp .env.example .env
npx expo start
```

### App `.env` (safe — public credentials only)
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-publishable-key
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=     # Google OAuth web client ID (Google Cloud Console)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=     # Google OAuth iOS client ID (for native sign-in flow)
```

### Supabase Edge Function Secrets (server-side only)
```
YOUCAM_API_KEY=your-youcam-key
ANTHROPIC_API_KEY=your-claude-key
APPLE_SHARED_SECRET=           # App Store Connect → In-App Purchases → App-Specific Shared Secret
GOOGLE_SERVICE_ACCOUNT_JSON=   # Google Play Console → Setup → API access → service account JSON key
ANDROID_PACKAGE_NAME=          # e.g. com.perfectskindiary.app
```

> **EAS Build required** — Google Sign-In and IAP use native modules (`@react-native-google-signin/google-signin`, `react-native-iap`) that are incompatible with Expo Go. Use `eas build --profile preview` for development builds on device.

---

## 🏆 Hackathon Context

**Event:** AI DevSummit 2026
**Challenge:** Perfect Corp — *Building the Next Generation of AI-Driven Consumer Experiences*
**Requirement:** Integrate at least one Perfect Corp API to solve a real consumer need

**Perfect Corp APIs Used:**
- `AI-Skin-Analysis` (HD) — daily skin tracking backbone
- `AI-Skin-Simulation` — Day 1 goal image generation
- `AI-Skin-Tone-Analysis` — onboarding personalisation

**Why PerfectSkinDiary fits the challenge:**
- Goal Image gives users a concrete, photorealistic target — not just abstract scores
- AM/PM routine correlation creates a feedback loop between products and measurable skin results
- Export feature creates genuine clinical utility for dermatologist consultations
- Three Perfect Corp APIs used in distinct, meaningful ways across the Track lifecycle
- Clear monetisation pathway: freemium subscriptions + skincare brand affiliate recommendations

---

## 📄 License

MIT — Built for hackathon purposes.