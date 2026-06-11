import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL    = 'https://sandbox.itunes.apple.com/verifyReceipt';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw Object.assign(new Error('Missing authorization'), { status: 401 });

    const body = await req.json() as {
      platform:      'ios' | 'android';
      transactionId: string;
      receipt:       string;   // iOS: base64 receipt data; Android: purchaseToken
      productId:     string;
    };
    const { platform, transactionId, receipt, productId } = body;

    if (!platform || !transactionId || !receipt || !productId) {
      throw Object.assign(new Error('Missing required fields: platform, transactionId, receipt, productId'), { status: 400 });
    }

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

    // ── Idempotency: already processed this transaction? ──────────────────────
    const { data: existingTx } = await adminClient
      .from('coin_transactions')
      .select('id')
      .eq('reference_id', transactionId)
      .eq('type', 'purchase')
      .maybeSingle();

    if (existingTx) {
      // Safe to re-return success without re-crediting.
      const { data: wallet } = await adminClient
        .from('wallets')
        .select('coin_balance')
        .eq('user_id', user.id)
        .single();
      return new Response(
        JSON.stringify({ success: true, coins_added: 0, new_balance: wallet?.coin_balance ?? 0, idempotent: true }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Platform receipt validation ───────────────────────────────────────────
    let validationPassed = false;

    if (platform === 'ios') {
      validationPassed = await validateAppleReceipt(receipt, transactionId);
    } else if (platform === 'android') {
      validationPassed = await validateGooglePurchase(productId, receipt);
    } else {
      throw Object.assign(new Error('Invalid platform — must be "ios" or "android"'), { status: 400 });
    }

    if (!validationPassed) {
      throw Object.assign(new Error('Receipt validation failed. Please contact support if this persists.'), { status: 422 });
    }

    // ── Look up coin package ──────────────────────────────────────────────────
    const { data: pkg, error: pkgError } = await adminClient
      .from('coin_packages')
      .select('coin_amount, bonus_coins')
      .eq('product_id', productId)
      .eq('is_active', true)
      .maybeSingle();

    if (pkgError || !pkg) {
      throw Object.assign(new Error(`Unknown product: ${productId}`), { status: 404 });
    }

    const coinsToCredit = (pkg as { coin_amount: number; bonus_coins: number }).coin_amount
                        + (pkg as { coin_amount: number; bonus_coins: number }).bonus_coins;

    // ── Credit coins + record transaction ─────────────────────────────────────
    const { error: creditError } = await adminClient.rpc('credit_coins', {
      p_user_id: user.id,
      p_amount:  coinsToCredit,
    });
    if (creditError) throw new Error(`Credit failed: ${creditError.message}`);

    await adminClient.from('coin_transactions').insert({
      user_id:      user.id,
      amount:       coinsToCredit,
      type:         'purchase',
      reference_id: transactionId,
    });

    const { data: wallet } = await adminClient
      .from('wallets')
      .select('coin_balance')
      .eq('user_id', user.id)
      .single();

    return new Response(
      JSON.stringify({ success: true, coins_added: coinsToCredit, new_balance: wallet?.coin_balance ?? coinsToCredit }),
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

// ── Apple receipt validation ──────────────────────────────────────────────────
async function validateAppleReceipt(receipt: string, expectedTransactionId: string): Promise<boolean> {
  const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET');
  const payload = {
    'receipt-data':             receipt,
    password:                   sharedSecret,
    'exclude-old-transactions': true,
  };

  // Try production first; fall back to sandbox on status 21007 (sandbox receipt).
  let res  = await fetch(APPLE_PRODUCTION_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  let json = await res.json() as {
    status: number;
    latest_receipt_info?: Array<{ transaction_id: string }>;
  };

  if (json.status === 21007) {
    res  = await fetch(APPLE_SANDBOX_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    json = await res.json() as typeof json;
  }

  if (json.status !== 0) return false;

  return (json.latest_receipt_info ?? []).some(tx => tx.transaction_id === expectedTransactionId);
}

// ── Google Play receipt validation ────────────────────────────────────────────
async function validateGooglePurchase(productId: string, purchaseToken: string): Promise<boolean> {
  const packageName        = Deno.env.get('ANDROID_PACKAGE_NAME') ?? 'com.perfectskindiary.app';
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountJson) {
    console.error('GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping Android validation');
    return false;
  }

  const serviceAccount = JSON.parse(serviceAccountJson) as { client_email: string; private_key: string };
  const accessToken    = await getGoogleAccessToken(serviceAccount);

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;
  const verifyRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!verifyRes.ok) return false;

  const json = await verifyRes.json() as { purchaseState?: number };
  // purchaseState 0 = purchased
  return json.purchaseState === 0;
}

async function getGoogleAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now     = Math.floor(Date.now() / 1_000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3_600,
  };

  const b64url = (s: string) => btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const enc    = new TextEncoder();

  const headerB64   = b64url(JSON.stringify(header));
  const payloadB64  = b64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const pemContents = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|[\n\r]/g, '');
  const pemBytes    = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const cryptoKey   = await crypto.subtle.importKey(
    'pkcs8', pemBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );
  const signature  = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(signingInput));
  const sigB64     = b64url(String.fromCharCode(...new Uint8Array(signature)));
  const jwt        = `${signingInput}.${sigB64}`;

  const tokenRes  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenJson = await tokenRes.json() as { access_token: string };
  return tokenJson.access_token;
}
