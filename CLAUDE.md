# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **NativeWind** for styling utilities
- **Supabase** — PostgreSQL DB, Storage (photos/goal images), Auth, Edge Functions (Deno) as secure API proxy
- **Claude API** (`claude-haiku-4-5-20251001`) for plain-language skin analysis summaries
- **Perfect Corp APIs** (proxied through Supabase Edge Functions):
  - `AI-Skin-Analysis` HD — daily 16-metric skin scores
  - `AI-Skin-Simulation` — Day 1 goal image generation
  - `AI-Skin-Tone-Analysis` — onboarding Fitzpatrick type

### Platform-specific UI split

Components use `.ios.tsx` / `.android.tsx` suffixes — Metro picks the correct file automatically. No `Platform.OS` checks in the component layer.

- **iOS**: Liquid Glass design (iOS 26), `expo-blur` BlurView
- **Android**: Gluestack UI v2

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

- `entries` table has `UNIQUE(issue_id, entry_date)` — enforces one photo per day per issue at the DB level (the UI also disables the button, but the constraint is the safety net)
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
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Edge Function secrets (Supabase dashboard only):
```
YOUCAM_API_KEY=
ANTHROPIC_API_KEY=
```
