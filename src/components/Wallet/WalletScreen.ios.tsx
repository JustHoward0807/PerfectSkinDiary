import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, StyleSheet, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
// Type-only import — erased at runtime, never triggers NitroModules bootstrap
import type { Product, Purchase, PurchaseError } from 'react-native-iap';
import { IOSColors, Colors, Radius } from '../../theme';
import { APP_VERSION, COPYRIGHT_YEAR } from '../../constants/version';
import { Header } from '../ui';
import { useWallet } from '../../hooks/useWallet';
import { fetchCoinPackages, validatePurchase, redeemCode, type CoinPackage } from '../../services/supabase/walletService';
import EmailGateSheet from '../ui/EmailGateSheet/EmailGateSheet';
import { supabase } from '../../services/supabase/supabase';

// ── React Native IAP — lazy require so Expo Go doesn't crash ─────────────────
// react-native-iap v15 uses NitroModules which require a native build. In Expo
// Go, NitroModules are unavailable and the static import crashes the whole file.
// Using a try/catch require lets the screen load (IAP silently disabled) in
// Expo Go and works normally in an EAS dev or production build.
type IAPModule = {
  initConnection:          () => Promise<string>;
  endConnection:           () => Promise<void>;
  getProducts:             (p: { skus: string[] }) => Promise<Product[]>;
  requestPurchase:         (p: { sku: string; andDangerouslyFinishTransactionAutomaticallyIOS?: boolean }) => Promise<Purchase | null>;
  finishTransaction:       (p: { purchase: Purchase; isConsumable: boolean }) => Promise<string | void>;
  purchaseUpdatedListener: (cb: (p: Purchase) => void | Promise<void>) => { remove: () => void };
  purchaseErrorListener:   (cb: (e: PurchaseError) => void)            => { remove: () => void };
};

let iap: IAPModule | null = null;
try { iap = require('react-native-iap'); } catch { /* Expo Go — NitroModules unavailable */ }
// ─────────────────────────────────────────────────────────────────────────────

const BG   = '#F2F2F7';
const CARD = '#FFFFFF';

export default function WalletScreen() {
  const { bottom }                  = useSafeAreaInsets();
  const wallet                      = useWallet();
  const [packages,      setPackages]    = useState<CoinPackage[]>([]);
  const [iapProducts,   setIapProducts] = useState<Product[]>([]);
  const [iapReady,      setIapReady]    = useState(false);
  const [redeemInput,   setRedeemInput] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [purchasingId,  setPurchasingId]  = useState<string | null>(null);
  const [emailGateVisible, setEmailGateVisible] = useState(false);
  const pendingProductId = useRef<string | null>(null);
  const scrollRef        = useRef<ScrollView>(null);

  // ── Load packages from Supabase ────────────────────────────────────────────
  useEffect(() => {
    fetchCoinPackages()
      .then(setPackages)
      .catch(() => { /* silently fail — packages section stays empty */ });
  }, []);

  // ── IAP connection ─────────────────────────────────────────────────────────
  useEffect(() => {
    let purchaseUpdateSub: { remove: () => void } | null = null;
    let purchaseErrorSub:  { remove: () => void } | null = null;

    const setupIAP = async () => {
      if (!iap) return; // Expo Go — IAP module not available

      try {
        await iap.initConnection();
      } catch {
        // IAP unavailable (simulator / no StoreKit entitlement) — degrade gracefully.
        return;
      }

      // Must set up listeners BEFORE any purchase request.
      purchaseUpdateSub = iap.purchaseUpdatedListener(async (purchase: Purchase) => {
        const receipt = Platform.OS === 'ios'
          ? purchase.transactionReceipt
          : purchase.purchaseToken;

        if (!receipt) return;

        try {
          await validatePurchase({
            platform:      Platform.OS as 'ios' | 'android',
            transactionId: purchase.transactionId ?? purchase.productId,
            receipt,
            productId:     purchase.productId,
          });
          await iap!.finishTransaction({ purchase, isConsumable: true });
          await wallet.refresh();
          setPurchasingId(null);
          Alert.alert('🎉 Purchase Successful', 'Coins have been added to your wallet!');
        } catch (err) {
          Alert.alert(
            'Purchase Error',
            err instanceof Error ? err.message : 'Validation failed. Please contact support.',
          );
          setPurchasingId(null);
        }
      });

      purchaseErrorSub = iap.purchaseErrorListener((error: PurchaseError) => {
        setPurchasingId(null);
        if ((error as { code?: string }).code !== 'E_USER_CANCELLED') {
          Alert.alert('Purchase Failed', error.message ?? 'Something went wrong.');
        }
      });

      setIapReady(true);
    };

    setupIAP();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      iap?.endConnection();
    };
  }, []);

  // ── Fetch store prices once IAP is ready AND packages are loaded ──────────
  useEffect(() => {
    if (!iapReady || packages.length === 0 || !iap) return;
    iap.getProducts({ skus: packages.map(p => p.product_id) })
      .then(setIapProducts)
      .catch(() => { /* store prices unavailable — show dash */ });
  }, [iapReady, packages]);

  // ── Buy handler ────────────────────────────────────────────────────────────
  const handleBuyPress = async (productId: string) => {
    if (!iap) {
      Alert.alert('Not Available', 'In-app purchases require a native build. Use an EAS build to purchase coins.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if ((user as { is_anonymous?: boolean } | null)?.is_anonymous) {
      // Prompt to link email before purchasing.
      pendingProductId.current = productId;
      setEmailGateVisible(true);
      return;
    }

    setPurchasingId(productId);
    try {
      await iap.requestPurchase({ sku: productId, andDangerouslyFinishTransactionAutomaticallyIOS: false });
    } catch {
      setPurchasingId(null);
    }
  };

  const handleEmailLinked = async () => {
    setEmailGateVisible(false);
    const id = pendingProductId.current;
    pendingProductId.current = null;
    if (id && iap) {
      setPurchasingId(id);
      try {
        await iap.requestPurchase({ sku: id, andDangerouslyFinishTransactionAutomaticallyIOS: false });
      } catch {
        setPurchasingId(null);
      }
    }
  };

  // ── Redeem handler ─────────────────────────────────────────────────────────
  const handleRedeem = async () => {
    const code = redeemInput.trim();
    if (!code) return;

    setRedeemLoading(true);
    try {
      const result = await redeemCode(code);
      setRedeemInput('');
      await wallet.refresh();
      Alert.alert('🎉 Code Redeemed!', `${result.coins_added} coin${result.coins_added !== 1 ? 's' : ''} have been added to your wallet.`);
    } catch (err) {
      Alert.alert('Invalid Code', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setRedeemLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getStorePrice = (productId: string): string => {
    const p = iapProducts.find(i => i.productId === productId);
    return p?.localizedPrice ?? '—';
  };

  const balanceLabel = wallet.loading
    ? '—'
    : wallet.isInTrial
      ? `Free Trial  •  ${wallet.trialDaysLeft}d left`
      : `${wallet.balance ?? 0}`;

  return (
    <View style={styles.root}>
      {/* Same pattern as TrackDetail: plain View root → Header → ScrollView */}
      <Header title="My Wallet" onBack={() => router.back()} />

      {/* KeyboardAvoidingView shrinks the scroll area so the redeem input
          stays above the keyboard when focused. */}
      <KeyboardAvoidingView style={styles.kav} behavior="padding">
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 60 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Balance Card ─────────────────────────────────────────────────── */}
        <BlurView intensity={60} tint="systemChromeMaterial" style={styles.balanceCard}>
          <Ionicons name="cash-outline" size={36} color={Colors.primary} style={{ marginBottom: 6 }} />
          <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          {wallet.loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : wallet.isInTrial ? (
            <Text style={styles.trialText}>{balanceLabel}</Text>
          ) : (
            <View style={styles.balanceRow}>
              <Text style={styles.balanceBig}>{wallet.balance ?? 0}</Text>
              <Ionicons name="ellipse" size={20} color="#FFD700" style={{ marginLeft: 6 }} />
            </View>
          )}
        </BlurView>

        {/* ── Packages ─────────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeading}>Top-up Packages</Text>

        {packages.length === 0 && !wallet.loading && (
          <Text style={styles.emptyHint}>No packages available right now.</Text>
        )}

        {packages.map((pkg) => {
          const storePrice   = getStorePrice(pkg.product_id);
          const isPurchasing = purchasingId === pkg.product_id;

          return (
            <BlurView
              key={pkg.id}
              intensity={pkg.is_featured ? 60 : 40}
              tint="systemChromeMaterial"
              style={[styles.packageCard, pkg.is_featured && styles.packageCardFeatured]}
            >
              {/* Badge */}
              {pkg.badge && (
                <View style={[
                  styles.badgePill,
                  pkg.badge_style === 'tertiary' ? styles.badgeTertiary : styles.badgePrimary,
                ]}>
                  <Text style={styles.badgeText}>{pkg.badge.toUpperCase()}</Text>
                </View>
              )}

              <View style={styles.packageRow}>
                {/* Icon */}
                <View style={styles.packageIconCircle}>
                  <Ionicons
                    name={pkg.is_featured ? 'flash' : 'ellipse-outline'}
                    size={22}
                    color={Colors.primary}
                  />
                </View>

                {/* Name + coins */}
                <View style={styles.packageInfo}>
                  <Text style={styles.packageName}>{pkg.display_name}</Text>
                  <View style={styles.packageCoinsRow}>
                    <Text style={styles.packageCoins}>{pkg.coin_amount}</Text>
                    <Ionicons name="ellipse" size={11} color="#FFD700" />
                    {pkg.bonus_coins > 0 && (
                      <Text style={styles.packageCoins}>{`+ ${pkg.bonus_coins} Bonus`}</Text>
                    )}
                  </View>
                </View>

                {/* Price + buy */}
                <View style={styles.packagePriceCol}>
                  {pkg.original_price_display && (
                    <Text style={styles.strikethrough}>{pkg.original_price_display}</Text>
                  )}
                  <Pressable
                    style={[styles.buyBtn, isPurchasing && styles.buyBtnDisabled]}
                    onPress={() => handleBuyPress(pkg.product_id)}
                    disabled={isPurchasing || !!purchasingId}
                  >
                    {isPurchasing
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={styles.buyBtnText}>{storePrice}</Text>
                    }
                  </Pressable>
                </View>
              </View>
            </BlurView>
          );
        })}

        {/* ── Redeem Code ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeading}>Redeem Code</Text>

        <BlurView intensity={50} tint="systemChromeMaterial" style={styles.redeemCard}>
          <View style={styles.redeemRow}>
            <TextInput
              style={styles.redeemInput}
              placeholder="e.g., SKIN2024"
              placeholderTextColor={IOSColors.secondaryLabel}
              autoCapitalize="characters"
              autoCorrect={false}
              value={redeemInput}
              onChangeText={setRedeemInput}
              editable={!redeemLoading}
              onFocus={() => {
                // Give the keyboard time to animate in, then scroll to bottom
                // so the redeem row is fully above the keyboard.
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
              }}
            />
            <Pressable
              style={[styles.redeemBtn, redeemLoading && styles.redeemBtnDisabled]}
              onPress={handleRedeem}
              disabled={redeemLoading}
            >
              {redeemLoading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.redeemBtnText}>Redeem</Text>
              }
            </Pressable>
          </View>
        </BlurView>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Coins are used to run AI skin analyses. 1 coin per analysis.
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerSecure}>
            <Ionicons name="lock-closed-outline" size={13} color={IOSColors.secondaryLabel} />
            <Text style={styles.footerSecureText}>Secure Payment</Text>
          </View>
          <Text style={styles.footerVersion}>© {COPYRIGHT_YEAR} PerfectSkinDiary  •  {APP_VERSION}</Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <EmailGateSheet
        visible={emailGateVisible}
        onLinked={handleEmailLinked}
        onDismiss={() => {
          setEmailGateVisible(false);
          pendingProductId.current = null;
        }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Same root/scroll/content pattern as TrackDetail ─────────────────────────
  root:    { flex: 1, backgroundColor: BG },
  kav:     { flex: 1 },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 12 },

  // Balance card
  balanceCard: {
    borderRadius: Radius.md, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: IOSColors.separator,
    paddingVertical: 24, paddingHorizontal: 20,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    color: IOSColors.secondaryLabel, textTransform: 'uppercase', marginBottom: 8,
  },
  balanceRow:  { flexDirection: 'row', alignItems: 'center' },
  balanceBig:  { fontSize: 48, fontWeight: '700', color: Colors.primary },
  trialText:   { fontSize: 22, fontWeight: '700', color: Colors.primary },

  // Section heading
  sectionHeading: {
    fontSize: 20, fontWeight: '700', color: IOSColors.label, marginTop: 8,
  },
  emptyHint: { fontSize: 14, color: IOSColors.secondaryLabel, textAlign: 'center', marginTop: 4 },

  // Package cards
  packageCard: {
    borderRadius: Radius.md, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: IOSColors.separator,
    padding: 16, marginTop: 4,
  },
  packageCardFeatured: {
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  badgePill: {
    position: 'absolute', top: -1, left: 12,
    paddingHorizontal: 10, paddingVertical: 3,
    borderBottomLeftRadius: Radius.full, borderBottomRightRadius: Radius.full,
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
  },
  badgePrimary:  { backgroundColor: Colors.primary },
  badgeTertiary: { backgroundColor: '#33504C' },
  badgeText: {
    fontSize: 9, fontWeight: '700', color: '#FFF', letterSpacing: 0.8,
  },
  packageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8,
  },
  packageIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: CARD, borderWidth: StyleSheet.hairlineWidth, borderColor: IOSColors.separator,
    alignItems: 'center', justifyContent: 'center',
  },
  packageInfo: { flex: 1 },
  packageName: { fontSize: 15, fontWeight: '600', color: IOSColors.label },
  packageCoinsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  packageCoins: { fontSize: 13, color: Colors.primary },
  packagePriceCol: { alignItems: 'flex-end', gap: 4 },
  strikethrough: {
    fontSize: 11, color: IOSColors.secondaryLabel, textDecorationLine: 'line-through',
  },
  buyBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 8, paddingHorizontal: 16, minWidth: 64, alignItems: 'center',
  },
  buyBtnDisabled: { opacity: 0.6 },
  buyBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Redeem section
  redeemCard: {
    borderRadius: Radius.md, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: IOSColors.separator,
    padding: 16,
  },
  redeemRow:  { flexDirection: 'row', gap: 10, alignItems: 'center' },
  redeemInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth, borderColor: IOSColors.separator,
    borderRadius: Radius.sm, paddingVertical: 10, paddingHorizontal: 14,
    fontSize: 16, color: IOSColors.label, backgroundColor: CARD,
  },
  redeemBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', minWidth: 80,
  },
  redeemBtnDisabled: { opacity: 0.6 },
  redeemBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Footer
  disclaimer: {
    fontSize: 13, color: IOSColors.secondaryLabel, textAlign: 'center',
    fontStyle: 'italic', marginTop: 4,
  },
  footer: { alignItems: 'center', gap: 6, paddingVertical: 16, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: IOSColors.separator },
  footerSecure: { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.6 },
  footerSecureText: { fontSize: 12, fontWeight: '600', color: IOSColors.secondaryLabel },
  footerVersion: { fontSize: 12, color: IOSColors.secondaryLabel },
});
