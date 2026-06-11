import { supabase } from './supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Wallet {
  coin_balance: number;
  updated_at:   string;
}

export interface CoinPackage {
  id:                     string;
  product_id:             string;
  display_name:           string;
  coin_amount:            number;
  bonus_coins:            number;
  badge:                  string | null;
  badge_style:            string | null;   // 'primary' | 'tertiary' | null
  is_featured:            boolean;
  original_price_display: string | null;   // display-only strikethrough e.g. "$11.24"
  sort_order:             number;
}

export interface CheckAndDeductResult {
  allowed:           boolean;
  reason:            'trial' | 'coins' | 'insufficient';
  remaining_balance: number | null;
  trial_days_left?:  number;
}

export interface RedeemCodeResult {
  coins_added: number;
  new_balance: number;
}

export interface ValidatePurchaseResult {
  success:     boolean;
  coins_added: number;
  new_balance: number;
  idempotent?: boolean;
}

// ── Functions ──────────────────────────────────────────────────────────────────

/** Fetch the current user's wallet balance.
 *  Returns { coin_balance: 0 } for users whose wallet row was not yet created
 *  (e.g. accounts created before the migration was applied). */
export async function fetchWallet(): Promise<Wallet> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('wallets')
    .select('coin_balance, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();          // returns null instead of error when no row exists

  // Hard error (network, RLS, etc.)
  if (error) throw new Error(`fetchWallet failed: ${error.message}`);

  // No row yet — treat as zero balance (credit_coins will upsert on next action)
  if (!data) return { coin_balance: 0, updated_at: new Date().toISOString() };

  return data as Wallet;
}

/** Fetch all active coin packages sorted by sort_order. */
export async function fetchCoinPackages(): Promise<CoinPackage[]> {
  const { data, error } = await supabase
    .from('coin_packages')
    .select('id, product_id, display_name, coin_amount, bonus_coins, badge, badge_style, is_featured, original_price_display, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`fetchCoinPackages failed: ${error.message}`);
  return (data ?? []) as CoinPackage[];
}

/**
 * Call before running any skin analysis.
 * Checks trial status server-side; deducts 1 coin atomically if past trial.
 * Returns whether the analysis is allowed and why.
 */
export async function checkAndDeduct(issueId?: string): Promise<CheckAndDeductResult> {
  const { data, error } = await supabase.functions.invoke('check-and-deduct', {
    body: { issue_id: issueId ?? null },
  });

  if (error) {
    // Try to extract a human-readable message from the Edge Function error body.
    let message = 'Could not verify coin balance. Please try again.';
    try {
      // supabase-js wraps Edge Function HTTP errors in error.context
      const errBody = await (error as unknown as { context?: Response }).context?.json?.();
      if (typeof errBody?.error === 'string') message = errBody.error;
    } catch { /* use default */ }
    throw new Error(message);
  }

  return data as CheckAndDeductResult;
}

/** Redeem a promotional code — credits coins server-side. */
export async function redeemCode(code: string): Promise<RedeemCodeResult> {
  const { data, error } = await supabase.functions.invoke('redeem-code', {
    body: { code },
  });

  if (error) {
    let message = 'Redeem failed. Please try again.';
    try {
      const errBody = await (error as unknown as { context?: Response }).context?.json?.();
      if (typeof errBody?.error === 'string') message = errBody.error;
    } catch { /* use default */ }
    throw new Error(message);
  }

  return data as RedeemCodeResult;
}

/**
 * Validate an IAP purchase receipt with Apple / Google server APIs.
 * Only call this after a successful purchaseUpdatedListener event.
 */
export async function validatePurchase(params: {
  platform:      'ios' | 'android';
  transactionId: string;
  receipt:       string;
  productId:     string;
}): Promise<ValidatePurchaseResult> {
  const { data, error } = await supabase.functions.invoke('validate-purchase', {
    body: params,
  });

  if (error) {
    let message = 'Purchase validation failed. Please contact support.';
    try {
      const errBody = await (error as unknown as { context?: Response }).context?.json?.();
      if (typeof errBody?.error === 'string') message = errBody.error;
    } catch { /* use default */ }
    throw new Error(message);
  }

  return data as ValidatePurchaseResult;
}
