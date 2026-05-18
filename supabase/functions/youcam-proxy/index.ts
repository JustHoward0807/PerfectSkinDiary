import { createClient } from 'jsr:@supabase/supabase-js@2';

const YOUCAM_BASE = 'https://yce-api-01.makeupar.com';

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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

    const { path, method, body } = await req.json() as {
      path: string;
      method: string;
      body?: unknown;
    };

    // Only allow YouCam S2S paths
    if (!path.startsWith('/s2s/')) {
      throw Object.assign(new Error('Invalid path'), { status: 400 });
    }

    const youcamRes = await fetch(`${YOUCAM_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${Deno.env.get('YOUCAM_API_KEY')}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const data = await youcamRes.json();

    return new Response(JSON.stringify(data), {
      status: youcamRes.status,
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
