import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase/supabase';
import { fetchWallet } from '../services/supabase/walletService';

const TRIAL_DAYS = 2;

export interface WalletState {
  /** Coin balance, or null while loading for the first time. */
  balance:       number | null;
  /** True while the user is still within the 2-day free-trial window. */
  isInTrial:     boolean;
  /** Days remaining in the trial (0 when not in trial). */
  trialDaysLeft: number;
  loading:       boolean;
  /** Re-fetch the wallet from Supabase (e.g. after a purchase or redeem). */
  refresh:       () => Promise<void>;
}

/**
 * Provides real-time wallet state.
 *
 * Trial status is computed client-side from user.created_at for display
 * purposes only. The authoritative gating check always runs server-side inside
 * the check-and-deduct Edge Function.
 */
export function useWallet(): WalletState {
  const [balance,       setBalance]       = useState<number | null>(null);
  const [isInTrial,     setIsInTrial]     = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [loading,       setLoading]       = useState(true);

  const computeTrial = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const createdAt = new Date(user.created_at);
    const now       = new Date();
    const daysSince = (now.getTime() - createdAt.getTime()) / (86_400 * 1_000);
    const inTrial   = daysSince < TRIAL_DAYS;

    setIsInTrial(inTrial);
    setTrialDaysLeft(inTrial ? Math.ceil(TRIAL_DAYS - daysSince) : 0);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const wallet = await fetchWallet();
      setBalance(wallet.coin_balance);
    } catch {
      // Wallet row might not exist yet for brand-new users — keep null balance.
    }
    await computeTrial();
  }, [computeTrial]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      await refresh();
      if (mounted) setLoading(false);
    };

    load();
    return () => { mounted = false; };
  }, [refresh]);

  return { balance, isInTrial, trialDaysLeft, loading, refresh };
}
