/**
 * Design tokens — single source of truth for both platforms.
 *
 * Android: use `Colors` (DESIGN.md palette) and `Radius`.
 * iOS:     use `IOSColors` (system-semantic approximations) and `Radius`.
 *          BlurView tints and system materials handle the rest at render time.
 */

/** DESIGN.md Android palette */
export const Colors = {
  primary:            '#7D5A4F',
  onPrimary:          '#FFFFFF',
  secondary:          '#7A6557',
  onSecondary:        '#FFFFFF',
  surface:            '#FDF8F3',
  surfaceVariant:     '#F5EDE3',
  onSurface:          '#2E1F1A',
  onSurfaceVariant:   '#6B5A53',
  outline:            '#D4C4B8',
  outlineSubtle:      '#EAE0D6',
  error:              '#9B3E28',
  onError:            '#FFFFFF',
} as const;

/** iOS system semantic color approximations (light mode) */
export const IOSColors = {
  label:              '#000000',
  secondaryLabel:     '#8E8E93',
  tertiaryLabel:      '#3C3C43',
  quaternaryLabel:    '#C7C7CC',
  background:         '#F2F2F7',
  fill:               '#1C1C1E',
  separator:          'rgba(0,0,0,0.18)',
  subtleSeparator:    'rgba(0,0,0,0.12)',
} as const;

/** DESIGN.md border radius — shared across platforms */
export const Radius = {
  sm:   8,
  md:   16,
  lg:   24,
  full: 9999,
} as const;
