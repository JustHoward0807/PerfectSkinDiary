import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const METRIC_LABELS: Record<string, string> = {
  hd_wrinkle:     'Wrinkles',
  hd_pore:        'Pores',
  hd_acne:        'Acne',
  hd_moisture:    'Moisture',
  hd_redness:     'Redness',
  hd_oiliness:    'Oiliness',
  hd_texture:     'Texture',
  hd_radiance:    'Radiance',
  hd_firmness:    'Firmness',
  hd_age_spot:    'Age Spots',
  hd_dark_circle: 'Dark Circles',
  hd_eye_bag:     'Eye Bags',
};

// ── Single-entry helpers (existing) ──────────────────────────────────────────

function getMetricScore(scores: Record<string, unknown>, key: string): number | null {
  const m = scores[key] as Record<string, unknown> | undefined;
  if (!m) return null;
  const whole = m.whole as Record<string, unknown> | undefined;
  const v = whole?.ui_score ?? whole?.raw_score ?? m.ui_score ?? m.raw_score;
  return typeof v === 'number' ? Math.round(v) : null;
}

function buildMetricLines(scores: Record<string, unknown>): string {
  const lines: string[] = [];
  const overall = (scores as { all?: { score?: number } }).all?.score;
  if (overall != null) lines.push(`Overall: ${overall}`);
  const skinAge = (scores as { skin_age?: number }).skin_age;
  if (skinAge != null) lines.push(`Estimated skin age: ${skinAge}`);
  for (const [key, label] of Object.entries(METRIC_LABELS)) {
    const val = getMetricScore(scores, key);
    if (val != null) lines.push(`${label}: ${val}`);
  }
  return lines.join('\n');
}

// ── Trend helpers (new) ───────────────────────────────────────────────────────

interface TrendEntry {
  date: string;
  scores: Record<string, unknown>;
}

function buildTrendPrompt(entries: TrendEntry[], products: { name: string; brand: string | null }[]): string {
  const n = entries.length;
  const firstDate = entries[0].date;
  const lastDate  = entries[n - 1].date;

  // Build score table: header + one row per entry
  const metricKeys = Object.keys(METRIC_LABELS);
  const header = ['Metric', ...entries.map((_, i) => `D${i + 1} (${e_shortDate(entries[i].date)})`), 'Change'].join(' | ');
  const separator = header.split('').map(() => '-').join('');

  const rows = metricKeys.map(key => {
    const label  = METRIC_LABELS[key];
    const scores = entries.map(e => getMetricScore(e.scores, key));
    const first  = scores[0];
    const last   = scores[n - 1];
    const change = first != null && last != null ? (last - first > 0 ? `+${last - first}` : String(last - first)) : 'n/a';
    const cells  = scores.map(v => v != null ? String(v) : '—');
    return [label, ...cells, change].join(' | ');
  });

  // Also include overall + skin age
  const overallRow = (() => {
    const vals = entries.map(e => {
      const v = (e.scores as { all?: { score?: number } }).all?.score;
      return v != null ? Math.round(v) : null;
    });
    const first = vals[0], last = vals[n - 1];
    const change = first != null && last != null ? (last - first > 0 ? `+${last - first}` : String(last - first)) : 'n/a';
    return ['Overall score', ...vals.map(v => v != null ? String(v) : '—'), change].join(' | ');
  })();

  const skinAgeRow = (() => {
    const vals = entries.map(e => {
      const v = (e.scores as { skin_age?: number }).skin_age;
      return typeof v === 'number' ? v : null;
    });
    const first = vals[0], last = vals[n - 1];
    const change = first != null && last != null ? (last - first > 0 ? `+${last - first}` : String(last - first)) : 'n/a';
    return ['Skin age (est.)', ...vals.map(v => v != null ? String(v) : '—'), change].join(' | ');
  })();

  const table = [header, separator, overallRow, skinAgeRow, ...rows].join('\n');

  const productLine = products.length > 0
    ? `Products used: ${products.map(p => p.name + (p.brand ? ` (${p.brand})` : '')).join(', ')}.`
    : '';

  return `Skin progress data — ${n} entries from ${firstDate} to ${lastDate}.

${table}

${productLine}

Write exactly 4 one-sentence bullet insights about this patient's skin progress trend. Focus on what changed most, patterns worth monitoring, and any notable observations. Return only the 4 bullet text lines — one sentence per line, no numbering, no bullet symbols, no extra text.`;
}

function e_shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw Object.assign(new Error('Missing authorization header'), { status: 401 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

    const body = await req.json() as {
      // Single-entry mode (existing)
      scores?: Record<string, unknown>;
      // Trend mode (new)
      entries?: TrendEntry[];
      // Shared
      products: Array<{ name: string; brand: string | null; category: string | null }>;
    };

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const isTrendMode = Array.isArray(body.entries) && body.entries.length > 0;

    if (isTrendMode) {
      // ── Trend mode: multi-entry progress analysis ──
      const userPrompt = buildTrendPrompt(body.entries!, body.products ?? []);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: 'You are a factual skin-health assistant. Be concise, warm, and clinically accurate. Never give medical advice or recommend new products.',
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
      const json = await res.json();
      const raw: string = (json.content[0].text as string).trim();

      const bullets = raw
        .split('\n')
        .map((l: string) => l.replace(/^[\-\•\*]\s*/, '').trim())
        .filter((l: string) => l.length > 0)
        .slice(0, 5);

      return new Response(JSON.stringify({ bullets }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });

    } else {
      // ── Single-entry mode (unchanged) ──
      const scores = body.scores ?? {};
      const products = body.products ?? [];

      const metricLines = buildMetricLines(scores);
      const productLine = products.length > 0
        ? `The user currently uses: ${products.map(p => `${p.name}${p.brand ? ` (${p.brand})` : ''}`).join(', ')}.`
        : 'The user has not listed any skincare products.';

      const userPrompt = `Skin analysis scores (0–100 scale, higher is better):
${metricLines}

${productLine}

Write exactly 3 short sentences that help the user understand their skin's current state. Do not recommend any new products. If products are listed you may briefly note how they relate to the scores.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: 'You are a factual skin-health assistant. Be concise, warm, and clear. Never give medical advice or recommend new products.',
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
      const json = await res.json();
      const summary: string = (json.content[0].text as string).trim();

      return new Response(JSON.stringify({ summary }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
