export const METRICS = [
  { key: 'hd_wrinkle',    label: 'Wrinkle',    short: 'Wrinkle'   },
  { key: 'hd_pore',       label: 'Pore',        short: 'Pore'      },
  { key: 'hd_acne',       label: 'Acne',        short: 'Acne'      },
  { key: 'hd_moisture',   label: 'Moisture',    short: 'Moisture'  },
  { key: 'hd_redness',    label: 'Redness',     short: 'Redness'   },
  { key: 'hd_oiliness',   label: 'Oiliness',    short: 'Oiliness'  },
  { key: 'hd_texture',    label: 'Texture',     short: 'Texture'   },
  { key: 'hd_radiance',   label: 'Radiance',    short: 'Radiance'  },
  { key: 'hd_firmness',   label: 'Firmness',    short: 'Firmness'  },
  { key: 'hd_age_spot',   label: 'Age Spot',    short: 'Age Spot'  },
  { key: 'hd_dark_circle',label: 'Dark Circle', short: 'D.Circle'  },
  { key: 'hd_eye_bag',    label: 'Eye Bag',     short: 'Eye Bag'   },
] as const;

export function computeOverallScore(data: unknown): number {
  if (!data || typeof data !== 'object') return 0;
  const d = data as Record<string, unknown>;
  const all = d.all as Record<string, unknown> | undefined;
  if (all && typeof all.score === 'number') return Math.round(all.score);
  const values = Object.values(d).filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function getMetricScore(data: unknown, key: string): number {
  if (!data || typeof data !== 'object') return 0;
  const d = data as Record<string, unknown>;
  const metric = d[key] as Record<string, unknown> | undefined;
  if (!metric) return 0;
  const whole = metric.whole as Record<string, unknown> | undefined;
  if (whole && typeof whole.ui_score === 'number') return Math.round(whole.ui_score);
  if (typeof metric.ui_score === 'number') return Math.round(metric.ui_score);
  return 0;
}

export function getMetricDelta(delta: unknown, key: string): number | null {
  if (!delta || typeof delta !== 'object') return null;
  const d = delta as Record<string, unknown>;
  const metric = d[key] as Record<string, unknown> | undefined;
  if (!metric) return null;
  const whole = metric.whole as Record<string, unknown> | undefined;
  if (whole && typeof whole.ui_score === 'number') return Math.round(whole.ui_score);
  if (typeof metric.ui_score === 'number') return Math.round(metric.ui_score);
  return null;
}
