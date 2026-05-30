import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, StyleSheet, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
// Type-only import — erased at runtime, never triggers NitroModules bootstrap
import type { Product, Purchase, PurchaseError } from 'react-native-iap';
import { Colors as C, Radius } from '../../theme';
import { APP_VERSION, COPYRIGHT_YEAR } from '../../constants/version';
import { Header } from '../ui';
import { useWallet } from '../../hooks/useWallet';
import { fetchCoinPackages, validatePurchase, redeemCode, type CoinPackage } from '../../services/supabase/walletService';
import EmailGateSheet from '../ui/EmailGateSheet/EmailGateSheet';
import { supabase } from '../../services/supabase/supabase';

// ── React Native IAP — lazy require so Expo Go doesn't crash ─────────────────
type IAPModule = {
  initConnection:          () => Promise<string>;
  endConnection:           () => Promise<void>;
  getProducts:             (p: { skus: string[] }) => Promise<Product[]>;
  requestPurchase:         (p: { sku: string }) => Promise<Purchase | null>;
  finishTransaction:       (p: { purchase: Purchase; isConsumable: boolean }) => Promise<string | void>;
  purchaseUpdatedListener: (cb: (p: Purchase) => void | Promise<void>) => { remove: () => void };
  purchaseErrorListener:   (cb: (e: PurchaseError) => void)            => { remove: () => void };
};

let iap: IAPModule | null = null;
try { iap = require('react-native-iap'); } catch { /* Expo Go — NitroModules unavailable */ }
// ─────────────────────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const { bottom }                   = useSafeAreaInsets();
  const wallet                       = useWallet();
  const [packages,      setPackages]    = useState<CoinPackage[]>([]);
  const [iapProducts,   setIapProducts] = useState<Product[]>([]);
  const [iapReady,      setIapReady]    = useState(false);
  const [redeemInput,   setRedeemInput]  = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [purchasingId,  setPurchasingId]  = useState<string | null>(null);
  const [emailGateVisible, setEmailGateVisible] = useState(false);
  const pendingProductId = useRef<string | null>(null);
  const scrollRef        = useRef<ScrollView>(null);

  // ── Load packages from Supabase ────────────────────────────────────────────
  useEffect(() => {
    fetchCoinPackages()
      .then(setPackages)
      .catch(() => {});
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
        return;
      }

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
          Alert.alert('Purchase Successful', 'Coins have been added to your wallet!');
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
      .catch(() => {});
  }, [iapReady, packages]);

  // ── Buy handler ────────────────────────────────────────────────────────────
  const handleBuyPress = async (productId: string) => {
    if (!iap) {
      Alert.alert('Not Available', 'In-app purchases require a native build. Use an EAS build to purchase coins.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if ((user as { is_anonymous?: boolean } | null)?.is_anonymous) {
      pendingProductId.current = productId;
      setEmailGateVisible(true);
      return;
    }

    setPurchasingId(productId);
    try {
      await iap.requestPurchase({ sku: productId });
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
        await iap.requestPurchase({ sku: id });
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
      Alert.alert('Code Redeemed!', `${result.coins_added} coin${result.coins_added !== 1 ? 's' : ''} added to your wallet.`);
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

  return (
    <View style={styles.root}>
      {/* Same pattern as TrackDetail: plain View root → Header → ScrollView */}
      <Header title="My Wallet" onBack={() => router.back()} />

      <KeyboardAvoidingView style={styles.kav} behavior="height">
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 60 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Balance Card ─────────────────────────────────────────────────── */}
        <View style={styles.balanceCard}>
          <Ionicons name="cash-outline" size={36} color={C.primary} style={{ marginBottom: 6 }} />
          <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          {wallet.loading ? (
            <ActivityIndicator color={C.primary} />
          ) : wallet.isInTrial ? (
            <Text style={styles.trialText}>
              Free Trial  •  {wallet.trialDaysLeft}d left
            </Text>
          ) : (
            <View style={styles.balanceRow}>
              <Text style={styles.balanceBig}>{wallet.balance ?? 0}</Text>
              <Ionicons name="ellipse" size={20} color="#FFD700" style={{ marginLeft: 6 }} />
            </View>
          )}
        </View>

        {/* ── Packages ─────────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeading}>Top-up Packages</Text>

        {packages.length === 0 && !wallet.loading && (
          <Text style={styles.emptyHint}>No packages available right now.</Text>
        )}

        {packages.map((pkg) => {
          const isPurchasing = purchasingId === pkg.product_id;
          const storePrice   = getStorePrice(pkg.product_id);

          return (
            <View key={pkg.id} style={[styles.packageCard, pkg.is_featured && styles.packageCardFeatured]}>
              {pkg.badge && (
                <View style={[
                  styles.badgePill,
                  pkg.badge_style === 'tertiary' ? styles.badgeTertiary : styles.badgePrimary,
                ]}>
                  <Text style={styles.badgeText}>{pkg.badge.toUpperCase()}</Text>
                </View>
              )}

              <View style={styles.packageRow}>
                <View style={styles.packageIconCircle}>
                  <Ionicons
                    name={pkg.is_featured ? 'flash' : 'ellipse-outline'}
                    size={22}
                    color={C.primary}
                  />
                </View>

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

                <View style={styles.packagePriceCol}>
                  {pkg.original_price_display && (
                    <Text style={styles.strikethrough}>{pkg.original_price_display}</Text>
                  )}
                  <Pressable
                    style={[styles.buyBtn, isPurchasing && styles.buyBtnDisabled]}
                    onPress={() => handleBuyPress(pkg.product_id)}
                    disabled={isPurchasing || !!purchasingId}
                    android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    {isPurchasing
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={styles.buyBtnText}>{storePrice}</Text>
                    }
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}

        {/* ── Redeem Code ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeading}>Redeem Code</Text>

        <View style={styles.redeemCard}>
          <View style={styles.redeemRow}>
            <TextInput
              style={styles.redeemInput}
              placeholder="e.g., SKIN2024"
              placeholderTextColor={C.onSurfaceVariant}
              autoCapitalize="characters"
              autoCorrect={false}
              value={redeemInput}
              onChangeText={setRedeemInput}
              editable={!redeemLoading}
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
              }}
            />
            <Pressable
              style={[styles.redeemBtn, redeemLoading && styles.redeemBtnDisabled]}
              onPress={handleRedeem}
              disabled={redeemLoading}
              android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
            >
              {redeemLoading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.redeemBtnText}>Redeem</Text>
              }
            </Pressable>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Coins are used to run AI skin analyses. 1 coin per analysis.
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerSecure}>
            <Ionicons name="lock-closed-outline" size={13} color={C.onSurfaceVariant} />
            <Text style={styles.footerSecureText}>Secure Payment</Text>
          </View>
          <Text style={styles.footerVersion}>© {COPYRIGHT_YEAR} PerfectSkinDiary  •  {APP_VERSION}</Text>
        </View>

        {Platform.OS === 'android' && (
          <View style={{ height: Math.max(0, 8) }} />
        )}
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
  root:    { flex: 1, backgroundColor: C.surface },
  kav:     { flex: 1 },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 12 },

  // Balance card
  balanceCard: {
    backgroundColor: C.surfaceVariant,
    borderRadius: Radius.md, borderWidth: 1, borderColor: C.outline,
    paddingVertical: 24, paddingHorizontal: 20,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    color: C.onSurfaceVariant, textTransform: 'uppercase', marginBottom: 8,
  },
  balanceRow:  { flexDirection: 'row', alignItems: 'center' },
  balanceBig:  { fontSize: 48, fontWeight: '700', color: C.primary },
  trialText:   { fontSize: 22, fontWeight: '700', color: C.primary },

  // Section heading
  sectionHeading: {
    fontSize: 20, fontWeight: '700', color: C.onSurface, marginTop: 8,
  },
  emptyHint: { fontSize: 14, color: C.onSurfaceVariant, textAlign: 'center', marginTop: 4 },

  // Package cards
  packageCard: {
    backgroundColor: C.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: C.outline,
    padding: 16, marginTop: 4,
  },
  packageCardFeatured: {
    borderWidth: 1.5, borderColor: C.primary, backgroundColor: '#FFF5F2',
  },
  badgePill: {
    position: 'absolute', top: -1, left: 12,
    paddingHorizontal: 10, paddingVertical: 3,
    borderBottomLeftRadius: Radius.full, borderBottomRightRadius: Radius.full,
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
  },
  badgePrimary:  { backgroundColor: C.primary },
  badgeTertiary: { backgroundColor: '#33504C' },
  badgeText: {
    fontSize: 9, fontWeight: '700', color: '#FFF', letterSpacing: 0.8,
  },
  packageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8,
  },
  packageIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.surfaceVariant, borderWidth: 1, borderColor: C.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  packageInfo: { flex: 1 },
  packageName: { fontSize: 15, fontWeight: '600', color: C.onSurface },
  packageCoinsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  packageCoins: { fontSize: 13, color: C.primary },
  packagePriceCol: { alignItems: 'flex-end', gap: 4 },
  strikethrough: {
    fontSize: 11, color: C.onSurfaceVariant, textDecorationLine: 'line-through',
  },
  buyBtn: {
    backgroundColor: C.primary, borderRadius: Radius.full,
    paddingVertical: 8, paddingHorizontal: 16, minWidth: 64, alignItems: 'center', overflow: 'hidden',
  },
  buyBtnDisabled: { opacity: 0.6 },
  buyBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Redeem section
  redeemCard: {
    backgroundColor: C.surfaceVariant,
    borderRadius: Radius.md, borderWidth: 1, borderColor: C.outline,
    padding: 16,
  },
  redeemRow:  { flexDirection: 'row', gap: 10, alignItems: 'center' },
  redeemInput: {
    flex: 1,
    borderWidth: 1, borderColor: C.outline,
    borderRadius: Radius.sm, paddingVertical: 10, paddingHorizontal: 14,
    fontSize: 16, color: C.onSurface, backgroundColor: C.surface,
  },
  redeemBtn: {
    backgroundColor: C.primary, borderRadius: Radius.sm,
    paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center',
    minWidth: 80, overflow: 'hidden',
  },
  redeemBtnDisabled: { opacity: 0.6 },
  redeemBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Footer
  disclaimer: {
    fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center',
    fontStyle: 'italic', marginTop: 4,
  },
  footer: {
    alignItems: 'center', gap: 6, paddingVertical: 16, marginTop: 8,
    borderTopWidth: 1, borderColor: C.outline,
  },
  footerSecure: { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.6 },
  footerSecureText: { fontSize: 12, fontWeight: '600', color: C.onSurfaceVariant },
  footerVersion: { fontSize: 12, color: C.onSurfaceVariant },
});
