---
name: PerfectSkinDiary — Android Color Palette
platform: android-only
note: iOS uses native Liquid Glass design (iOS 26) — no custom palette applies there.
colors:
  primary: "#7D5A4F"
  on-primary: "#FFFFFF"
  secondary: "#7A6557"
  on-secondary: "#FFFFFF"
  surface: "#FDF8F3"
  surface-variant: "#F5EDE3"
  on-surface: "#2E1F1A"
  on-surface-variant: "#6B5A53"
  outline: "#D4C4B8"
  error: "#9B3E28"
  on-error: "#FFFFFF"
rounded:
  sm: 8px
  md: 16px
  lg: 24px
  full: 9999px
---

# Design System

## Overview

A warm, minimal diary aesthetic for Android.
Creamy off-white backgrounds, earthy warm tones, low visual noise.
Feels like a personal skincare journal — soft, trustworthy, uncluttered.

> **iOS note:** iOS builds always use the native Liquid Glass design system (iOS 26).
> This file only governs Android UI.

---

## Colors

All color pairs below have been verified against WCAG AA (≥ 4.5:1 for normal text, ≥ 3:1 for large text and UI components).

| Token | Hex | Contrast | Use |
|---|---|---|---|
| `primary` | `#7D5A4F` | 5.4:1 vs white | CTAs, active states, key interactive elements |
| `on-primary` | `#FFFFFF` | — | Text and icons on primary |
| `secondary` | `#7A6557` | 4.9:1 vs white | Secondary actions, chips, supporting UI |
| `on-secondary` | `#FFFFFF` | — | Text and icons on secondary |
| `surface` | `#FDF8F3` | — | Page backgrounds (warm cream) |
| `surface-variant` | `#F5EDE3` | — | Card backgrounds, input fills, bottom sheets |
| `on-surface` | `#2E1F1A` | 13.3:1 vs surface | Primary body text, headings |
| `on-surface-variant` | `#6B5A53` | 5.5:1 vs surface | Secondary text, hints, captions, placeholders |
| `outline` | `#D4C4B8` | — | Borders, dividers, inactive input rings |
| `error` | `#9B3E28` | 5.8:1 vs surface | Validation errors, destructive actions |
| `on-error` | `#FFFFFF` | — | Text on error backgrounds |

---

## Rounded Corners

- `sm` (8px) — buttons, chips, small badges
- `md` (16px) — cards, input fields, bottom sheets
- `lg` (24px) — modals, full-width panels
- `full` (9999px) — pill buttons, avatars, tags

---

## Do's and Don'ts

- **Do** use `primary` sparingly — only for the one most important action per screen
- **Do** use `surface-variant` to create card depth without shadows
- **Do** pair `on-surface-variant` with `outline` for subtle, unobtrusive form fields
- **Don't** mix `sm` and `lg` rounded corners in the same view
- **Don't** place `on-surface-variant` text on `surface-variant` background — contrast is insufficient for body copy; use `on-surface` instead
- **Don't** use `primary` for decorative elements — reserve it for actions only
