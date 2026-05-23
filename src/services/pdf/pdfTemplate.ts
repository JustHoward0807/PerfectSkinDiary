import type { RecentEntry } from '../supabase/issueService';
import {
  extractScores,
  extractMaskUrls,
  METRICS,
  WRINKLE_REGIONS,
  PORE_REGIONS,
  type ExtractedScores,
  type ExtractedMaskUrls,
} from './scoreExtractor';

// ─── date helpers ────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shortDate(iso: string): string {
  const d = parseLocal(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function longDate(iso: string): string {
  const d = parseLocal(iso);
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseLocal(toIso).getTime() - parseLocal(fromIso).getTime()) / 86_400_000);
}

function todayLong(): string {
  const d = new Date();
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── internal entry representation ───────────────────────────────────────────

interface PdfEntry {
  dayNumber: number;
  dateShort: string;
  dateLabel: string; // "D1 · 5 May"
  photoSrc: string | null;
  scores: ExtractedScores;
  maskSrcs: ExtractedMaskUrls;
}

function buildEntries(raw: RecentEntry[], b64: Map<string, string>): PdfEntry[] {
  const first = raw[0].entry_date;
  return raw.map(e => {
    const day = daysBetween(first, e.entry_date) + 1;
    const short = shortDate(e.entry_date);
    const masks = extractMaskUrls(e.analysis_scores);
    const resolvedMasks: ExtractedMaskUrls = {} as ExtractedMaskUrls;
    for (const k of Object.keys(masks) as (keyof ExtractedMaskUrls)[]) {
      const url = masks[k];
      resolvedMasks[k] = url ? (b64.get(url) ?? url) : null;
    }
    const photoUrl = e.photo_url;
    return {
      dayNumber: day,
      dateShort: short,
      dateLabel: `D${day} · ${short}`,
      photoSrc: photoUrl ? (b64.get(photoUrl) ?? photoUrl) : null,
      scores: extractScores(e.analysis_scores),
      maskSrcs: resolvedMasks,
    };
  });
}

// ─── score helpers ────────────────────────────────────────────────────────────

function sc(v: number | null): string {
  return v == null ? '&mdash;' : String(v);
}

function cellStyle(v: number | null): string {
  if (v == null) return '';
  const hue = Math.min(130, Math.max(0, Math.round(v * 1.3)));
  return `background:hsl(${hue},58%,90%)`;
}

function netHtml(first: number | null, last: number | null): string {
  if (first == null || last == null) return '<td class="net flat">&mdash;</td>';
  const d = last - first;
  if (d > 0) return `<td class="net up">&#9650; +${d}</td>`;
  if (d < 0) return `<td class="net down">&#9660; ${d}</td>`;
  return '<td class="net flat">&#8212;</td>';
}

function get(scores: ExtractedScores, key: keyof ExtractedScores): number | null {
  return scores[key] as number | null;
}

// ─── SVG chart ────────────────────────────────────────────────────────────────

const CHART_X_L = 70, CHART_X_R = 712;
const CHART_Y_T = 30,  CHART_Y_B = 250;

function xPos(idx: number, total: number): number {
  if (total === 1) return (CHART_X_L + CHART_X_R) / 2;
  return CHART_X_L + (idx / (total - 1)) * (CHART_X_R - CHART_X_L);
}

function yPos(score: number | null): number {
  if (score == null) return CHART_Y_B;
  return CHART_Y_B - (score / 100) * (CHART_Y_B - CHART_Y_T);
}

function polyline(entries: PdfEntry[], scoreKey: keyof ExtractedScores, color: string, width: number): string {
  const pts = entries.map((e, i) =>
    `${xPos(i, entries.length).toFixed(1)},${yPos(get(e.scores, scoreKey)).toFixed(1)}`
  ).join(' ');
  const circles = entries.map((e, i) => {
    const x = xPos(i, entries.length).toFixed(1);
    const y = yPos(get(e.scores, scoreKey)).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="3" fill="#fff" stroke="${color}" stroke-width="2"/>`;
  }).join('');
  return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>${circles}`;
}

function svgChart(entries: PdfEntry[]): string {
  const gridLines = [0, 20, 40, 60, 80, 100].map(v => {
    const y = yPos(v).toFixed(1);
    return `<line x1="${CHART_X_L}" y1="${y}" x2="${CHART_X_R}" y2="${y}" stroke="#e7edf2" stroke-width="1"/>
<text x="${CHART_X_L - 9}" y="${(yPos(v) + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#64737f">${v}</text>`;
  }).join('\n');

  const xLabels = entries.map((e, i) => {
    const x = xPos(i, entries.length).toFixed(1);
    return `<text x="${x}" y="267" text-anchor="middle" font-size="9.5" fill="#5a6b7b">D${e.dayNumber} &middot; ${e.dateShort}</text>`;
  }).join('\n');

  const lines = [
    { key: 'overall'  as keyof ExtractedScores, color: '#0d5c63', w: 2.8 },
    { key: 'acne'     as keyof ExtractedScores, color: '#c0473e', w: 2.2 },
    { key: 'redness'  as keyof ExtractedScores, color: '#d98324', w: 2.2 },
    { key: 'oiliness' as keyof ExtractedScores, color: '#7a5ba6', w: 2.2 },
  ];

  return `<svg viewBox="0 0 760 300" xmlns="http://www.w3.org/2000/svg" width="100%">
${gridLines}
${xLabels}
${lines.map(l => polyline(entries, l.key, l.color, l.w)).join('\n')}
</svg>`;
}

// ─── filmstrip ────────────────────────────────────────────────────────────────

const SILHOUETTE = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#aab4be" stroke-width="1.3"><circle cx="12" cy="9" r="4.3"/><path d="M4.5 20.5c0-4 3.3-6 7.5-6s7.5 2 7.5 6"/></svg>`;

function filmstrip(entries: PdfEntry[]): string {
  return entries.map(e => {
    const imgHtml = e.photoSrc
      ? `<img src="${e.photoSrc}" style="width:100%;height:100%;object-fit:contain;border-radius:6px;" />`
      : SILHOUETTE;
    const imgStyle = e.photoSrc ? 'background:#f0f3f5;overflow:hidden;' : 'background:#f5f8f9';
    return `<div class="film-cell">
  <div class="film-img" style="${imgStyle}">${imgHtml}</div>
  <div class="film-cap">D${e.dayNumber}<span>${e.dateShort}</span></div>
</div>`;
  }).join('');
}

// ─── concern-map ──────────────────────────────────────────────────────────────

const GRAD = `background:radial-gradient(circle at 38% 42%,#e85d4e 0%,#f0a93f 26%,#f6e07a 46%,#bfe0c8 70%,#eef3f3 100%);opacity:.78`;

function concernMap(entries: PdfEntry[]): string {
  if (entries.length < 2) return '';

  const first = entries[0];
  const last  = entries[entries.length - 1];

  // Pick top 3 metrics by absolute change
  const ranked = METRICS
    .map(m => ({
      ...m,
      delta: (get(last.scores, m.key) ?? 0) - (get(first.scores, m.key) ?? 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  return ranked.map(m => {
    const delta = m.delta;
    const netCls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    const netArrow = delta > 0 ? `&#9650; +${delta}` : delta < 0 ? `&#9660; ${delta}` : '&#8212;';

    const cells = entries.map(e => {
      const score    = get(e.scores, m.key);
      const maskSrc  = e.maskSrcs[m.maskKey];
      const photoSrc = e.photoSrc;

      let imgStyle: string;
      let imgHtml: string;

      if (maskSrc && photoSrc) {
        // Greyscale photo kills competing colour; mask at 0.85 opacity is clearly visible.
        imgStyle = 'position:relative;overflow:hidden;background:#000;opacity:1;';
        imgHtml  = `<img src="${photoSrc}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;filter:grayscale(1) brightness(0.9);" />`
                 + `<img src="${maskSrc}"  style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;opacity:0.85;" />`;
      } else if (maskSrc) {
        imgStyle = 'background:#000;opacity:1;overflow:hidden;';
        imgHtml  = `<img src="${maskSrc}" style="width:100%;height:100%;object-fit:contain;" />`;
      } else if (photoSrc) {
        imgStyle = 'background:#000;opacity:1;overflow:hidden;';
        imgHtml  = `<img src="${photoSrc}" style="width:100%;height:100%;object-fit:contain;filter:grayscale(1);" />`;
      } else {
        imgStyle = GRAD;
        imgHtml  = '';
      }

      return `<div class="m-cell">
  <div class="m-img" style="${imgStyle}">${imgHtml}</div>
  <div class="m-cap">D${e.dayNumber}<span class="mv">${score ?? '&mdash;'}</span></div>
</div>`;
    }).join('');

    return `<div class="m-row">
<div class="m-label">${m.label} <span class="m-net ${netCls}">${netArrow}</span></div>
<div class="m-strip">${cells}</div>
</div>`;
  }).join('');
}

// ─── score matrix row ─────────────────────────────────────────────────────────

function matrixRow(
  label: string,
  key: keyof ExtractedScores,
  entries: PdfEntry[],
  indent = false,
): string {
  const cells = entries.map(e => {
    const v = get(e.scores, key);
    return `<td class="cell" style="${cellStyle(v)}">${sc(v)}</td>`;
  }).join('');
  const netTd = entries.length > 1
    ? netHtml(get(entries[0].scores, key), get(entries[entries.length - 1].scores, key))
    : '<td class="net flat">&mdash;</td>';
  return `<tr><td class="rl${indent ? ' ind' : ''}">${label}</td>${cells}${netTd}</tr>`;
}

// ─── score matrix header ──────────────────────────────────────────────────────

function matrixHeader(entries: PdfEntry[]): string {
  const dateCols = entries.map(e =>
    `<th class="d">D${e.dayNumber}<span>${e.dateShort}</span></th>`
  ).join('');
  return `<thead><tr><th class="l">Dimension</th>${dateCols}<th>Net</th></tr></thead>`;
}

// ─── at-a-glance stats ────────────────────────────────────────────────────────

function glanceStat(
  label: string,
  bigVal: string,
  unit: string,
  delta: number | null,
  sub: string,
  invertDelta = false, // for skin age: decrease = good
): string {
  let deltaHtml = '';
  if (delta != null) {
    const good = invertDelta ? delta < 0 : delta > 0;
    const bad  = invertDelta ? delta > 0 : delta < 0;
    const cls  = good ? 'up' : bad ? 'down' : 'flat';
    const arrow = good ? '&#9650;' : bad ? '&#9660;' : '&#8212;';
    const sign  = delta > 0 ? '+' : '';
    deltaHtml = `<span class="stat-d ${cls}">${arrow} ${sign}${delta}</span>`;
  }
  return `<div class="stat">
  <div class="stat-l">${label}</div>
  <div class="stat-row"><span class="big">${bigVal}</span><span class="of">${unit}</span>${deltaHtml}</div>
  <div class="stat-sub">${sub}</div>
</div>`;
}

// ─── main generator ───────────────────────────────────────────────────────────

export function generatePdfHtml(raw: RecentEntry[], b64: Map<string, string>, aiInsight?: string[] | null): string {
  const entries = buildEntries(raw, b64);
  const first = entries[0];
  const last  = entries[entries.length - 1];
  const n     = entries.length;

  const overallFirst = first.scores.overall;
  const overallLast  = last.scores.overall;
  const overallDelta = (overallFirst != null && overallLast != null) ? overallLast - overallFirst : null;

  const ageFirst = first.scores.skinAge;
  const ageLast  = last.scores.skinAge;
  const ageDelta = (ageFirst != null && ageLast != null) ? ageLast - ageFirst : null;

  const dateRange = n > 1
    ? `${shortDate(raw[0].entry_date)} &ndash; ${shortDate(raw[n - 1].entry_date)} ${parseLocal(raw[n-1].entry_date).getFullYear()}`
    : shortDate(raw[0].entry_date);

  const subFrom = overallFirst != null
    ? `from ${overallFirst} at first entry`
    : 'first entry';
  const ageSub = ageFirst != null
    ? `from ${ageFirst} yrs &middot; AI estimate`
    : 'AI estimate';

  const matrixRows = METRICS
    .map(m => matrixRow(m.label, m.key, entries))
    .join('');

  const wrinkleRows = WRINKLE_REGIONS
    .map(r => matrixRow(r.label, r.key, entries, true))
    .join('');

  const poreRows = PORE_REGIONS
    .map(r => matrixRow(r.label, r.key, entries, true))
    .join('');

  const header = matrixHeader(entries);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size:A4; margin:20mm 18mm 22mm 18mm; }
* { box-sizing:border-box; }
body { font-family:Helvetica,Arial,sans-serif; color:#1d2733; margin:0; font-size:11px; line-height:1.45; }
.serif { font-family:Georgia,'Times New Roman',serif; }
h1,h2 { margin:0; }
.header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0d5c63; padding-bottom:10px; margin-bottom:14px; }
.brand { display:flex; align-items:center; gap:10px; }
.logo { width:34px; height:34px; }
.brand-t .name { font-size:15px; font-weight:700; color:#0d5c63; }
.brand-t .sub { font-size:9px; color:#5c6b7a; text-transform:uppercase; letter-spacing:1.4px; }
.doc-title { text-align:right; }
.doc-title .t { font-size:17px; font-weight:700; }
.doc-title .d { font-size:9.5px; color:#5c6b7a; margin-top:2px; }
.section-h { font-size:12px; font-weight:700; color:#0d5c63; text-transform:uppercase; letter-spacing:1px; margin:16px 0 8px; padding-bottom:4px; border-bottom:1px solid #e0e9ea; page-break-after:avoid; }
.section-h:first-child { margin-top:0; }
.routine { display:flex; gap:10px; }
.rt { flex:1; border:1px solid #eef2f4; border-radius:7px; padding:8px 11px; background:#fbfcfc; }
.rt-h { font-size:9px; font-weight:700; letter-spacing:1.2px; margin-bottom:4px; }
.rt-h.am { color:#9a6608; } .rt-h.pm { color:#5a4b9c; }
.rt ul { margin:0; padding-left:15px; } .rt li { font-size:10px; margin-bottom:2px; }
.rt-note { font-size:8.6px; color:#64737f; font-style:italic; margin-top:5px; }
.snap { display:flex; gap:11px; margin-bottom:4px; }
.stat { flex:1; border:1px solid #e0e9ea; border-radius:8px; padding:11px 13px; background:#f7fafa; }
.stat-l { font-size:8.6px; text-transform:uppercase; letter-spacing:.7px; color:#64737f; }
.stat-row { display:flex; align-items:baseline; gap:5px; margin-top:3px; }
.big { font-size:27px; font-weight:700; color:#0d5c63; line-height:1; }
.of { font-size:10px; color:#64737f; }
.stat-d { font-size:11px; font-weight:700; margin-left:4px; }
.stat-d.up { color:#1e7a5b; } .stat-d.down { color:#c0473e; } .stat-d.flat { color:#64737f; }
.stat-sub { font-size:8.8px; color:#64737f; margin-top:4px; }
.insight { border:1px solid #dbe8e9; background:#f4fafa; border-radius:8px; padding:10px 14px; }
.insight .tag { font-size:8px; font-weight:700; letter-spacing:.8px; text-transform:uppercase; color:#0d5c63; background:#d9eeee; padding:2px 7px; border-radius:4px; display:inline-block; margin-bottom:6px; }
.insight ul { margin:0; padding-left:0; list-style:none; }
.insight li { position:relative; padding-left:15px; margin-bottom:6px; font-size:10.4px; }
.insight li:before { content:''; position:absolute; left:0; top:5px; width:5px; height:5px; border-radius:50%; background:#0d5c63; }
.chart-box { border:1px solid #e0e9ea; border-radius:8px; padding:11px 11px 5px; }
.legend { display:flex; gap:16px; flex-wrap:wrap; margin:2px 2px 0; }
.leg { font-size:9.3px; color:#42505e; display:flex; align-items:center; gap:5px; }
.ld { width:11px; height:3px; border-radius:2px; }
.film { display:flex; gap:6px; }
.film-cell { flex:1; }
.film-img { height:130px; border:1px solid #e3e9ec; border-radius:6px; display:flex; align-items:center; justify-content:center; }
.film-cap { font-size:8.6px; font-weight:700; color:#42505e; text-align:center; margin-top:3px; }
.film-cap span { display:block; font-weight:400; color:#64737f; font-size:8px; }
.m-row { margin-bottom:9px; page-break-inside:avoid; }
.m-label { font-size:10px; font-weight:700; color:#42505e; margin-bottom:4px; display:flex; align-items:center; gap:8px; }
.m-net { font-size:9px; font-weight:700; }
.m-net.up { color:#1e7a5b; } .m-net.down { color:#c0473e; } .m-net.flat { color:#64737f; }
.m-strip { display:flex; gap:6px; }
.m-cell { flex:1; }
.m-img { height:90px; border:1px solid #e3e9ec; border-radius:5px; background:radial-gradient(circle at 38% 42%,#e85d4e 0%,#f0a93f 26%,#f6e07a 46%,#bfe0c8 70%,#eef3f3 100%); opacity:.78; }
.m-cap { font-size:8.4px; color:#64737f; text-align:center; margin-top:2px; display:flex; justify-content:center; gap:5px; }
.m-cap .mv { font-weight:700; color:#42505e; }
.mask-note { font-size:8.7px; color:#64737f; font-style:italic; margin-top:3px; }
table.mx { width:100%; border-collapse:collapse; }
table.mx th { font-size:8.4px; color:#64737f; font-weight:700; padding:5px 4px; border-bottom:1.5px solid #d7e0e2; text-align:center; }
table.mx th.l { text-align:left; }
table.mx th.d span { display:block; font-weight:400; font-size:7.6px; }
table.mx td { padding:4px; border-bottom:1px solid #f0f3f5; text-align:center; font-variant-numeric:tabular-nums; }
table.mx td.rl { text-align:left; font-weight:600; font-size:10px; }
table.mx td.rl.ind { padding-left:16px; font-weight:400; color:#5a6b7b; font-size:9.4px; }
td.cell { font-weight:600; border-radius:3px; }
td.net { font-weight:700; }
td.net.up { color:#1e7a5b; } td.net.down { color:#c0473e; } td.net.flat { color:#64737f; }
.sub-h { font-size:9.5px; font-weight:700; color:#5c6b7a; text-transform:uppercase; letter-spacing:.6px; margin:12px 0 4px; }
.mx-note { font-size:8.6px; color:#64737f; font-style:italic; margin-top:6px; }
.limits { background:#fdf9f0; border:1px solid #f0e4c8; border-radius:8px; padding:10px 14px; }
.limits .lh { font-size:8.6px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:#7a5e0d; margin-bottom:5px; }
.limits ul { margin:0; padding-left:15px; }
.limits li { font-size:9.3px; color:#5f5430; margin-bottom:3px; }
.foot { margin-top:12px; padding-top:7px; border-top:1px solid #e7edf2; font-size:8.3px; color:#64737f; display:flex; justify-content:space-between; }
.pagebreak { page-break-before:always; }
</style></head><body>

<div class="header">
  <div class="brand">
    <svg class="logo" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill="#0d5c63"/>
      <path d="M20 9c5 5 8 9 8 13a8 8 0 0 1-16 0c0-4 3-8 8-13z" fill="#fff" opacity="0.95"/>
      <circle cx="17" cy="24" r="1.5" fill="#0d5c63"/><circle cx="22" cy="26" r="1.2" fill="#0d5c63"/>
    </svg>
    <div class="brand-t"><div class="name serif">PerfectSkinDiary</div>
      <div class="sub">AI Skin Analysis &middot; Skin Progress Record</div></div>
  </div>
  <div class="doc-title"><div class="t serif">Skin Progress Summary</div>
    <div class="d">Selected entries prepared for clinical review</div></div>
</div>

<div class="section-h">Regimen for this track</div>
<div class="routine">
  <div class="rt"><div class="rt-h am">AM</div><ul><li>Gentle gel cleanser</li><li>Vitamin C serum</li><li>Ceramide moisturiser</li><li>SPF 50</li></ul></div>
  <div class="rt"><div class="rt-h pm">PM</div><ul><li>Gentle gel cleanser</li><li>Ceramide moisturiser</li><li>Tretinoin 0.025% (alt. nights)</li></ul></div>
</div>
<div class="rt-note">Regimen recorded by the patient for the whole tracked period (not per individual day).</div>

<div class="section-h">At a glance</div>
<div class="snap">
  ${glanceStat('Overall skin score', String(overallLast ?? '&mdash;'), '/100', overallDelta, subFrom)}
  ${glanceStat('Estimated skin age', String(ageLast ?? '&mdash;'), 'yrs', ageDelta, ageSub, true)}
  ${glanceStat('Entries in this report', String(n), n === 1 ? 'day' : 'days', null, dateRange)}
</div>

<div class="section-h">AI-generated insight</div>
<div class="insight">
  <span class="tag">${aiInsight && aiInsight.length > 0 ? 'Generated by Claude &middot; verify against examination' : 'Illustrative only &mdash; connect live AI for personalised insights'}</span>
  <ul>
    ${(aiInsight && aiInsight.length > 0
        ? aiInsight
        : [
            'Overall skin score reflects cumulative change across the selected entries; continue monitoring to confirm the trend beyond short-term fluctuation.',
            'Acne and redness metrics may temporarily worsen when a new active ingredient is introduced before stabilising &mdash; consider this before adjusting the regimen.',
            'Oil balance and moisture often move inversely; if moisture falls while oiliness improves, a barrier-support step such as a ceramide moisturiser may help.',
            'Eye-area and firmness metrics change slowly; meaningful differences require tracking over weeks, not days.',
          ]
      ).map(line => `<li>${line}</li>`).join('\n    ')}
  </ul>
</div>

<div class="section-h">Trend across selected entries</div>
<div class="chart-box">
  ${svgChart(entries)}
  <div class="legend">
    <span class="leg"><span class="ld" style="background:#0d5c63"></span>Overall</span>
    <span class="leg"><span class="ld" style="background:#c0473e"></span>Acne / breakout</span>
    <span class="leg"><span class="ld" style="background:#d98324"></span>Redness</span>
    <span class="leg"><span class="ld" style="background:#7a5ba6"></span>Oil balance</span>
  </div>
</div>

<div class="pagebreak"></div>
<div class="section-h">Photo progression</div>
<div class="film">${filmstrip(entries)}</div>

${entries.length > 1 ? `
<div class="section-h">Concern-map comparison &mdash; largest movers</div>
${concernMap(entries)}
<div class="mask-note">Showing AI concern maps for the three dimensions that changed most across the selected entries. Per-day score shown beneath each map; warmer areas indicate greater concern intensity.</div>
` : ''}

<div class="pagebreak"></div>
<div class="section-h">Score log &mdash; all dimensions by day</div>
<table class="mx">
  ${header}
  <tbody>${matrixRows}</tbody>
</table>
<div class="mx-note">Scores 0&ndash;100 (Perfect Corp YouCam HD, normalised so higher = healthier). Cell shade red&rarr;green tracks score. &ldquo;Net&rdquo; = latest minus first entry.</div>

<div class="sub-h">Regional detail &mdash; wrinkles</div>
<table class="mx">
  ${header}
  <tbody>${wrinkleRows}</tbody>
</table>

<div class="sub-h">Regional detail &mdash; pores</div>
<table class="mx">
  ${header}
  <tbody>${poreRows}</tbody>
</table>

<div class="section-h">Methodology &amp; limitations</div>
<div class="limits">
  <div class="lh">Please read before interpreting</div>
  <ul>
    <li>Scores come from a consumer AI image-analysis API (Perfect Corp YouCam HD Skin Analysis), <b>not a validated clinical instrument</b>.</li>
    <li>Lighting, camera, angle and time of day are not standardised between photos and can shift scores independent of true skin change.</li>
    <li>The narrative insight is <b>generated by a large language model</b> from the score data and should be verified, not relied upon as diagnosis.</li>
    <li>This record is intended to <b>supplement, not replace</b>, in-person examination and clinical judgement.</li>
  </ul>
</div>

<div class="foot">
  <span>PerfectSkinDiary v1.0.0 &middot; AI Skin Analysis Summary</span>
  <span>Generated ${todayLong()} &middot; No personal identifiers included</span>
</div>
</body></html>`;
}
