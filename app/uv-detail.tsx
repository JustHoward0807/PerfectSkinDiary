import { useEffect, useRef, type ReactNode } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
  ActivityIndicator, Pressable, Linking, type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, IOSColors, Radius } from '../src/theme';
import { Header } from '../src/components/ui';
import { useWeather } from '../src/hooks/useWeather';
import { getUVLevel } from '../src/services/uvWeather';

const IS_IOS = Platform.OS === 'ios';
const surface     = IS_IOS ? IOSColors.background    : Colors.surface;
const textPrimary = IS_IOS ? IOSColors.label          : Colors.onSurface;
const textSub     = IS_IOS ? IOSColors.secondaryLabel : Colors.onSurfaceVariant;

const MAX_UV = 12;
const BAR_MAX_H = 64;
const CELL_W = 48;
const CELL_GAP = 4;

function formatHourLabel(h: number): string {
  if (h === 0)  return '12am';
  if (h < 12)  return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

// Platform-adaptive card: BlurView on iOS, surfaceVariant View on Android
function Card({ style, children }: { style?: ViewStyle; children: ReactNode }) {
  if (IS_IOS) {
    return (
      <BlurView intensity={50} tint="systemUltraThinMaterial" style={[styles.cardBase, styles.cardIOS, style]}>
        {children}
      </BlurView>
    );
  }
  return <View style={[styles.cardBase, styles.cardAndroid, style]}>{children}</View>;
}

export default function UVDetailScreen() {
  const { bottom } = useSafeAreaInsets();
  const weather = useWeather();
  const scrollRef = useRef<ScrollView>(null);
  const currentHour = new Date().getHours();

  useEffect(() => {
    if (!weather.loading && weather.hourlyUV.length > 0) {
      const x = Math.max(0, (currentHour - 3) * (CELL_W + CELL_GAP));
      setTimeout(() => scrollRef.current?.scrollTo({ x, animated: false }), 150);
    }
  }, [weather.loading]);

  return (
    <View style={[styles.root, { backgroundColor: surface }]}>
      <Header title="UV Index" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {weather.loading ? (
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
              color={IS_IOS ? IOSColors.fill : Colors.primary}
            />
            <Text style={[styles.loadingText, { color: textSub }]}>Loading UV data…</Text>
          </View>

        ) : weather.permissionDenied ? (
          <View style={styles.center}>
            <Ionicons name="location-outline" size={52} color={textSub} />
            <Text style={[styles.permTitle, { color: textPrimary }]}>Location needed</Text>
            <Text style={[styles.permSub, { color: textSub }]}>
              UV Index requires location access to show accurate data for your area.
            </Text>
            <Pressable
              onPress={() => Linking.openSettings()}
              style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.settingsBtnText}>Open Settings</Text>
            </Pressable>
          </View>

        ) : (
          <>
            {/* ── UV Hero ── */}
            <Card style={styles.heroCard}>
              <View style={styles.heroInner}>
                <Ionicons name="sunny" size={52} color={weather.uvLevel.color} />
                <Text style={[styles.uvBigNumber, { color: textPrimary }]}>
                  {weather.uvIndex}
                </Text>
                <View style={[styles.levelBadge, { backgroundColor: weather.uvLevel.color + '22' }]}>
                  <Text style={[styles.levelBadgeText, { color: weather.uvLevel.color }]}>
                    {weather.uvLevel.label.toUpperCase()}
                  </Text>
                </View>
              </View>
            </Card>

            {/* ── Sunrise / Sunset ── */}
            <Card>
              <View style={styles.sunRow}>
                <View style={styles.sunItem}>
                  <Ionicons name="arrow-up-circle-outline" size={26} color="#FF9F0A" />
                  <Text style={[styles.sunLabel, { color: textSub }]}>Sunrise</Text>
                  <Text style={[styles.sunTime, { color: textPrimary }]}>{weather.sunrise}</Text>
                </View>
                <View style={[styles.sunDivider, { backgroundColor: IS_IOS ? 'rgba(0,0,0,0.10)' : Colors.outline }]} />
                <View style={styles.sunItem}>
                  <Ionicons name="arrow-down-circle-outline" size={26} color="#FF6B35" />
                  <Text style={[styles.sunLabel, { color: textSub }]}>Sunset</Text>
                  <Text style={[styles.sunTime, { color: textPrimary }]}>{weather.sunset}</Text>
                </View>
              </View>
            </Card>

            {/* ── Hourly UV chart ── */}
            <View style={styles.hourlySection}>
              <Text style={[styles.sectionLabel, { color: textSub }]}>TODAY'S UV BY HOUR</Text>
              <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hourlyScroll}
              >
                {weather.hourlyUV.map((uv, h) => {
                  const isCurrent = h === currentHour;
                  const barH = Math.max(4, (uv / MAX_UV) * BAR_MAX_H);
                  const lvl = getUVLevel(Math.round(uv));
                  const currentHighlight = IS_IOS ? 'rgba(0,0,0,0.07)' : Colors.outlineSubtle;
                  return (
                    <View
                      key={h}
                      style={[
                        styles.hourCell,
                        isCurrent && { backgroundColor: currentHighlight, borderRadius: Radius.sm },
                      ]}
                    >
                      <Text style={[styles.hourUVVal, { color: uv >= 0.5 ? lvl.color : 'transparent' }]}>
                        {uv >= 0.5 ? Math.round(uv) : ' '}
                      </Text>
                      <View style={styles.hourBarContainer}>
                        <View style={[
                          styles.hourBar,
                          {
                            height: barH,
                            backgroundColor: uv >= 0.5
                              ? lvl.color
                              : (IS_IOS ? 'rgba(0,0,0,0.08)' : Colors.outline),
                          },
                        ]} />
                      </View>
                      <Text style={[
                        styles.hourLabel,
                        { color: isCurrent ? textPrimary : textSub, fontWeight: isCurrent ? '600' : '400' },
                      ]}>
                        {formatHourLabel(h)}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── SPF Advice ── */}
            <Card>
              <View style={styles.adviceRow}>
                <View style={[styles.adviceIcon, { backgroundColor: weather.uvLevel.color + '22' }]}>
                  <Ionicons name="shield-checkmark-outline" size={22} color={weather.uvLevel.color} />
                </View>
                <View style={styles.adviceText}>
                  <Text style={[styles.adviceTitle, { color: textPrimary }]}>Protection</Text>
                  <Text style={[styles.adviceSub, { color: textSub }]}>{weather.uvLevel.spfRec}</Text>
                </View>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 14 },

  // Loading / permission states
  center: { alignItems: 'center', gap: 12, paddingTop: 72, paddingHorizontal: 24 },
  loadingText: { fontSize: 14 },
  permTitle: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  permSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  settingsBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: Radius.full,
    marginTop: 8,
  },
  settingsBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  // Adaptive card
  cardBase: {
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardIOS: {
    overflow: 'hidden',
    borderColor: 'rgba(0,0,0,0.10)',
  },
  cardAndroid: {
    backgroundColor: Colors.surfaceVariant,
    borderColor: Colors.outline,
  },

  // Hero card
  heroCard: { paddingVertical: 32 },
  heroInner: { alignItems: 'center', gap: 8 },
  uvBigNumber: { fontSize: 80, fontWeight: '200', lineHeight: 88 },
  levelBadge: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  levelBadgeText: { fontSize: 13, fontWeight: '700', letterSpacing: 1.2 },

  // Sunrise/sunset row
  sunRow: { flexDirection: 'row', alignItems: 'center' },
  sunItem: { flex: 1, alignItems: 'center', gap: 4 },
  sunDivider: { width: 1, height: 52, opacity: 0.4 },
  sunLabel: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  sunTime: { fontSize: 18, fontWeight: '600' },

  // Hourly chart
  hourlySection: { gap: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginLeft: 2 },
  hourlyScroll: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 8,
    gap: CELL_GAP,
    paddingHorizontal: 2,
  },
  hourCell: { width: CELL_W, alignItems: 'center', gap: 4, paddingVertical: 6 },
  hourUVVal: { fontSize: 10, fontWeight: '600', height: 14 },
  hourBarContainer: { height: BAR_MAX_H, justifyContent: 'flex-end' },
  hourBar: { width: 8, borderRadius: 4 },
  hourLabel: { fontSize: 9 },

  // SPF advice card
  adviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adviceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  adviceText: { flex: 1, gap: 2 },
  adviceTitle: { fontSize: 15, fontWeight: '600' },
  adviceSub: { fontSize: 13, lineHeight: 18 },
});
