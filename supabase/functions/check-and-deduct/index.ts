import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRIAL_DAYS = 3;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw Object.assign(new Error('Missing authorization'), { status: 401 });

    // Parse body before creating any client (body can only be consumed once)
    const body = await req.json().catch(() => ({})) as { issue_id?: string };

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Trial window check ────────────────────────────────────────────────────
    // Use admin API to read the authoritative created_at from auth.users.
    const { data: adminUser, error: adminErr } = await adminClient.auth.admin.getUserById(user.id);
    if (adminErr || !adminUser.user) throw new Error('Could not fetch user metadata');

    const createdAt = new Date(adminUser.user.created_at);
    const now       = new Date();
    const daysSince = (now.getTime() - createdAt.getTime()) / (86_400 * 1_000);

    if (daysSince < TRIAL_DAYS) {
      const trialDaysLeft = Math.ceil(TRIAL_DAYS - daysSince);
      return new Response(
        JSON.stringify({
          allowed:           true,
          reason:            'trial',
          remaining_balance: null,
          trial_days_left:   trialDaysLeft,
        }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Past trial — attempt atomic deduction ─────────────────────────────────
    const { data: deductRows, error: deductError } = await adminClient.rpc('deduct_coin_atomic', {
      p_user_id: user.id,
    });

    if (deductError) throw new Error(`Deduction error: ${deductError.message}`);

    // deduct_coin_atomic returns SETOF (success BOOLEAN, remaining_balance INTEGER)
    const result = Array.isArray(deductRows) ? deductRows[0] : deductRows;
    const { success, remaining_balance } = result as { success: boolean; remaining_balance: number };

    if (!success) {
      return new Response(
        JSON.stringify({ allowed: false, reason: 'insufficient', remaining_balance }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Record deduction transaction ──────────────────────────────────────────
    await adminClient.from('coin_transactions').insert({
      user_id:      user.id,
      amount:       -1,
      type:         'analysis_deduct',
      reference_id: body.issue_id ?? null,
    });

    return new Response(
      JSON.stringify({ allowed: true, reason: 'coins', remaining_balance }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    const status  = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
