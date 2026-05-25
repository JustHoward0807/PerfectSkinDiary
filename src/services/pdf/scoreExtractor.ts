// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Scores = Record<string, any>;

export interface ExtractedScores {
  overall: number | null;
  skinAge: number | null;
  acne: number | null;
  redness: number | null;
  texture: number | null;
  pores: number | null;
  oiliness: number | null;
  moisture: number | null;
  radiance: number | null;
  firmness: number | null;
  wrinkle: number | null;
  ageSpot: number | null;
  darkCircle: number | null;
  eyeBag: number | null;
  wrinkleForehead: number | null;
  wrinkleGlabellar: number | null;
  wrinkleCrowfeet: number | null;
  wrinklePeriocular: number | null;
  wrinkleNasolabial: number | null;
  wrinkleMarionette: number | null;
  poreForehead: number | null;
  poreNose: number | null;
  poreCheek: number | null;
}

export interface ExtractedMaskUrls {
  acne: string | null;
  redness: string | null;
  texture: string | null;
  pores: string | null;
  oiliness: string | null;
  moisture: string | null;
  radiance: string | null;
  firmness: string | null;
  wrinkle: string | null;
  ageSpot: string | null;
  darkCircle: string | null;
  eyeBag: string | null;
}

function ui(s: Scores, ...path: string[]): number | null {
  let cur: unknown = s;
  for (const k of path) {
    if (!cur || typeof cur !== 'object') return null;
    cur = (cur as Scores)[k];
  }
  return typeof cur === 'number' ? Math.round(cur) : null;
}

function maskUrl(s: Scores, ...path: string[]): string | null {
  let cur: unknown = s;
  for (const k of path) {
    if (!cur || typeof cur !== 'object') return null;
    cur = (cur as Scores)[k];
  }
  return typeof cur === 'string' && cur.startsWith('http') ? cur : null;
}

// Tries metric-level output_mask_name first, then inside 'whole' as fallback.
// Handles both YouCam response shapes (URL at hd_acne.output_mask_name
// OR at hd_acne.whole.output_mask_name).
function maskUrlFlex(s: Scores, metric: string): string | null {
  return maskUrl(s, metric, 'output_mask_name')
      ?? maskUrl(s, metric, 'whole', 'output_mask_name');
}

export function extractScores(analysisScores: unknown): ExtractedScores {
  const s: Scores = (analysisScores as Scores) ?? {};
  return {
    overall: typeof s.all?.score === 'number' ? Math.round(s.all.score) : null,
    skinAge: typeof s.skin_age === 'number' ? s.skin_age : null,
    acne: ui(s, 'hd_acne', 'whole', 'ui_score'),
    redness: ui(s, 'hd_redness', 'ui_score'),
    texture: ui(s, 'hd_texture', 'whole', 'ui_score'),
    pores: ui(s, 'hd_pore', 'whole', 'ui_score'),
    oiliness: ui(s, 'hd_oiliness', 'ui_score'),
    moisture: ui(s, 'hd_moisture', 'ui_score'),
    radiance: ui(s, 'hd_radiance', 'ui_score'),
    firmness: ui(s, 'hd_firmness', 'ui_score'),
    wrinkle: ui(s, 'hd_wrinkle', 'whole', 'ui_score'),
    ageSpot: ui(s, 'hd_age_spot', 'ui_score'),
    darkCircle: ui(s, 'hd_dark_circle', 'ui_score'),
    eyeBag: ui(s, 'hd_eye_bag', 'ui_score'),
    wrinkleForehead: ui(s, 'hd_wrinkle', 'forehead', 'ui_score'),
    wrinkleGlabellar: ui(s, 'hd_wrinkle', 'glabellar', 'ui_score'),
    wrinkleCrowfeet: ui(s, 'hd_wrinkle', 'crowfeet', 'ui_score'),
    wrinklePeriocular: ui(s, 'hd_wrinkle', 'periocular', 'ui_score'),
    wrinkleNasolabial: ui(s, 'hd_wrinkle', 'nasolabial', 'ui_score'),
    wrinkleMarionette: ui(s, 'hd_wrinkle', 'marionette', 'ui_score'),
    poreForehead: ui(s, 'hd_pore', 'forehead', 'ui_score'),
    poreNose: ui(s, 'hd_pore', 'nose', 'ui_score'),
    poreCheek: ui(s, 'hd_pore', 'cheek', 'ui_score'),
  };
}

export function extractMaskUrls(analysisScores: unknown): ExtractedMaskUrls {
  const s: Scores = (analysisScores as Scores) ?? {};
  return {
    acne:       maskUrlFlex(s, 'hd_acne'),
    redness:    maskUrlFlex(s, 'hd_redness'),
    texture:    maskUrlFlex(s, 'hd_texture'),
    pores:      maskUrlFlex(s, 'hd_pore'),
    oiliness:   maskUrlFlex(s, 'hd_oiliness'),
    moisture:   maskUrlFlex(s, 'hd_moisture'),
    radiance:   maskUrlFlex(s, 'hd_radiance'),
    firmness:   maskUrlFlex(s, 'hd_firmness'),
    wrinkle:    maskUrlFlex(s, 'hd_wrinkle'),
    ageSpot:    maskUrlFlex(s, 'hd_age_spot'),
    darkCircle: maskUrlFlex(s, 'hd_dark_circle'),
    eyeBag:     maskUrlFlex(s, 'hd_eye_bag'),
  };
}

export const METRICS: { key: keyof ExtractedScores; maskKey: keyof ExtractedMaskUrls; label: string }[] = [
  { key: 'acne',       maskKey: 'acne',       label: 'Acne / breakout' },
  { key: 'redness',    maskKey: 'redness',    label: 'Redness' },
  { key: 'texture',    maskKey: 'texture',    label: 'Texture' },
  { key: 'pores',      maskKey: 'pores',      label: 'Pores' },
  { key: 'oiliness',   maskKey: 'oiliness',   label: 'Oil balance' },
  { key: 'moisture',   maskKey: 'moisture',   label: 'Moisture' },
  { key: 'radiance',   maskKey: 'radiance',   label: 'Radiance' },
  { key: 'firmness',   maskKey: 'firmness',   label: 'Firmness' },
  { key: 'wrinkle',    maskKey: 'wrinkle',    label: 'Wrinkles (overall)' },
  { key: 'ageSpot',    maskKey: 'ageSpot',    label: 'Age spots' },
  { key: 'darkCircle', maskKey: 'darkCircle', label: 'Dark circles' },
  { key: 'eyeBag',     maskKey: 'eyeBag',     label: 'Eye bags' },
];

export const WRINKLE_REGIONS: { key: keyof ExtractedScores; label: string }[] = [
  { key: 'wrinkleForehead',   label: 'Forehead' },
  { key: 'wrinkleGlabellar',  label: 'Glabellar' },
  { key: 'wrinkleCrowfeet',   label: "Crow's feet" },
  { key: 'wrinklePeriocular', label: 'Periocular' },
  { key: 'wrinkleNasolabial', label: 'Nasolabial' },
  { key: 'wrinkleMarionette', label: 'Marionette' },
];

export const PORE_REGIONS: { key: keyof ExtractedScores; label: string }[] = [
  { key: 'poreForehead', label: 'Forehead' },
  { key: 'poreNose',     label: 'Nose' },
  { key: 'poreCheek',    label: 'Cheek' },
];
