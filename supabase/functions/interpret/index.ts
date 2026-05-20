import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { scores, products } = await req.json() as {
      scores: Record<string, unknown>;
      products: Array<{ name: string; brand: string | null; category: string | null }>;
    };

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

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
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

const METRIC_LABELS: Record<string, string> = {
  hd_wrinkle:    'Wrinkles',
  hd_pore:       'Pores',
  hd_acne:       'Acne',
  hd_moisture:   'Moisture',
  hd_redness:    'Redness',
  hd_oiliness:   'Oiliness',
  hd_texture:    'Texture',
  hd_radiance:   'Radiance',
  hd_firmness:   'Firmness',
  hd_age_spot:   'Age Spots',
  hd_dark_circle: 'Dark Circles',
  hd_eye_bag:    'Eye Bags',
};

function buildMetricLines(scores: Record<string, unknown>): string {
  const lines: string[] = [];
  const s = scores as Record<string, { whole?: { ui_score?: number; raw_score?: number } }>;
  const overall = (scores as { all?: { score?: number } }).all?.score;
  if (overall != null) lines.push(`Overall: ${overall}`);
  const skinAge = (scores as { skin_age?: number }).skin_age;
  if (skinAge != null) lines.push(`Estimated skin age: ${skinAge}`);
  for (const [key, label] of Object.entries(METRIC_LABELS)) {
    const val = s[key]?.whole?.ui_score ?? s[key]?.whole?.raw_score;
    if (val != null) lines.push(`${label}: ${val}`);
  }
  return lines.join('\n');
}
