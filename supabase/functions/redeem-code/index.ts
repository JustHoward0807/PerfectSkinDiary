import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function humanizeRedeemError(reason: string | null): string {
  switch (reason) {
    case 'NOT_FOUND':       return 'This code does not exist. Please check and try again.';
    case 'EXPIRED':         return 'This code has expired.';
    case 'MAX_USES':        return 'This code has already been fully redeemed.';
    case 'INACTIVE':        return 'This code is no longer active.';
    case 'ALREADY_REDEEMED':return 'You have already redeemed this code.';
    default:                return 'Invalid code. Please try again.';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw Object.assign(new Error('Missing authorization'), { status: 401 });

    const { code } = await req.json() as { code?: string };
    if (!code?.trim()) throw Object.assign(new Error('Code is required'), { status: 400 });

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

    // ── Atomic redemption ─────────────────────────────────────────────────────
    const { data: result, error: rpcError } = await adminClient.rpc('redeem_code_atomic', {
      p_user_id: user.id,
      p_code:    code.trim().toUpperCase(),
    });

    if (rpcError) throw Object.assign(new Error(rpcError.message), { status: 400 });

    const { success, error_reason, coins_added, new_balance } = result as {
      success:      boolean;
      error_reason: string | null;
      coins_added:  number;
      new_balance:  number;
    };

    if (!success) {
      const statusCode =
        error_reason === 'NOT_FOUND'        ? 404 :
        error_reason === 'EXPIRED'          ? 410 :
        error_reason === 'MAX_USES'         ? 409 :
        error_reason === 'INACTIVE'         ? 422 :
        error_reason === 'ALREADY_REDEEMED' ? 409 : 400;
      throw Object.assign(new Error(humanizeRedeemError(error_reason)), { status: statusCode });
    }

    return new Response(
      JSON.stringify({ success: true, coins_added, new_balance }),
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
