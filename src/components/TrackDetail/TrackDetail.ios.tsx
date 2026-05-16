import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Image,
  PanResponder, Animated, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOSColors, Radius } from '../../theme';
import { Header } from '../ui';
import { trackResultStore } from '../../services/trackResultStore';
import { extractGoalImageFromZip } from '../../services/youcam/youcamApi';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

function computeScore(data: unknown): number {
  if (!data || typeof data !== 'object') return 0;
  const d = data as Record<string, unknown>;
  // Primary path: { all: { score: number } }
  const all = d.all as Record<string, unknown> | undefined;
  if (all && typeof all.score === 'number') return Math.round(all.score);
  // Fallback: average of output array ui_scores
  const output = d.output;
  if (Array.isArray(output) && output.length > 0) {
    const scores = output.map((e: unknown) => {
      const entry = e as Record<string, unknown>;
      return typeof entry.ui_score === 'number' ? entry.ui_score : 0;
    });
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  // Last fallback: average of all numeric top-level values
  const values = Object.values(d).filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

const todayIso = new Date().toISOString().split('T')[0];

// ── Component ───────────────────────────────────────────────────────────────

export default function TrackDetailIOS() {
  const { bottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { id: issueId } = useLocalSearchParams<{ id: string }>();
  const { analysisResult, simulationResult, trackName, photoUri } = trackResultStore.get();

  // ── Goal image extraction ──
  const [goalImageUri, setGoalImageUri] = useState<string | null>(null);
  const [goalLoading, setGoalLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const sim = simulationResult as Record<string, unknown> | null;
        const zipUrl = sim?.url as string | undefined;
        if (!zipUrl) return;
        const uri = await extractGoalImageFromZip(zipUrl);
        setGoalImageUri(uri);
      } catch (e) { console.error('[TrackDetail] extractGoalImageFromZip failed:', e); }
      finally { setGoalLoading(false); }
    })();
  }, []);

  // ── Slider ──
  // Two direct pixel-value Animated.Values — no interpolate() call, so no object recreation
  // on re-renders. setValue() bypasses React reconciliation entirely → no flash.
  const estW = screenWidth - 32;
  const [containerWidth, setContainerWidth] = useState(estW);
  const ctnWidthRef = useRef(estW);
  const clipWidthAnim = useRef(new Animated.Value(estW * 0.5)).current;
  const dividerLeftAnim = useRef(new Animated.Value(estW * 0.5 - 1)).current;

  const moveSlider = (x: number) => {
    const clamped = Math.max(2, Math.min(ctnWidthRef.current - 2, x));
    clipWidthAnim.setValue(clamped);
    dividerLeftAnim.setValue(clamped - 1);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => moveSlider(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => moveSlider(evt.nativeEvent.locationX),
    })
  ).current;

  // ── Mock entries ──
  const overallScore = computeScore(analysisResult);
  const mockEntries = [
    { id: '1', date: todayIso, photoUri: photoUri || null, score: overallScore, isToday: true },
  ];
  const alreadyLoggedToday = true;

  return (
    <View style={styles.root}>
      <Header title={trackName || 'Track Detail'} onBack={() => router.replace('/')} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Image comparison slider ── */}
        <View
          style={styles.sliderCard}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            ctnWidthRef.current = w;
            setContainerWidth(w);
            clipWidthAnim.setValue(w * 0.5);
            dividerLeftAnim.setValue(w * 0.5 - 1);
          }}
          {...panResponder.panHandlers}
        >
          {/* Layer 1: Goal image (full, behind) */}
          {goalLoading ? (
            <View style={[StyleSheet.absoluteFill, styles.placeholderBg]}>
              <ActivityIndicator color={IOSColors.fill} />
              <Text style={styles.placeholderHint}>Loading goal image…</Text>
            </View>
          ) : goalImageUri ? (
            <Image source={{ uri: goalImageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.placeholderBg]}>
              <Ionicons name="image-outline" size={36} color={IOSColors.secondaryLabel} />
              <Text style={styles.placeholderHint}>Goal image unavailable</Text>
            </View>
          )}

          {/* Layer 2: Original image (clipped to left portion — direct pixel Animated.Value) */}
          <Animated.View style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden',
            width: clipWidthAnim,
          }}>
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: containerWidth }}
                resizeMode="cover"
              />
            ) : (
              <View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: containerWidth }, styles.placeholderBg]}>
                <Ionicons name="person-outline" size={36} color={IOSColors.secondaryLabel} />
              </View>
            )}
          </Animated.View>

          {/* Layer 3: Divider — pointerEvents="none" so touches fall through to the card's PanResponder */}
          <Animated.View pointerEvents="none" style={[styles.divider, { left: dividerLeftAnim }]}>
            <BlurView intensity={60} tint="light" style={styles.dividerHandle}>
              <Ionicons name="code" size={14} color={IOSColors.label} />
            </BlurView>
          </Animated.View>

          {/* Layer 4: Corner labels */}
          <BlurView intensity={50} tint="dark" style={styles.labelDay1}>
            <Text style={styles.labelText}>DAY 1</Text>
          </BlurView>
          <BlurView intensity={50} tint="dark" style={styles.labelGoal}>
            <Ionicons name="sparkles" size={10} color="#FFFFFF" />
            <Text style={styles.labelText}> GOAL</Text>
          </BlurView>
        </View>

        {/* ── Overall progress ── */}
        <BlurView intensity={60} tint="systemThinMaterial" style={styles.progressCard}>
          <Text style={styles.progressLabel}>OVERALL PROGRESS</Text>
          <View style={styles.progressRight}>
            <Ionicons name="trending-up" size={16} color={IOSColors.fill} />
            <Text style={styles.progressValue}>+80%</Text>
          </View>
        </BlurView>

        {/* ── Daily log ── */}
        <Text style={styles.sectionTitle}>DAILY LOG</Text>

        <View style={styles.timeline}>
          {mockEntries.map((entry, index) => (
            <View key={entry.id} style={styles.timelineRow}>

              {/* Timeline marker column */}
              <View style={styles.markerCol}>
                <View style={[styles.markerLine, index === 0 && styles.markerLineHidden]} />
                <View style={[styles.marker, entry.isToday && styles.markerActive]}>
                  {entry.isToday ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.markerText}>{new Date(entry.date).getDate()}</Text>
                  )}
                </View>
                <View style={[styles.markerLine, index === mockEntries.length - 1 && styles.markerLineHidden]} />
              </View>

              {/* Entry card */}
              <Pressable style={styles.entryCard} onPress={() => {}}>
                <View style={styles.entryThumb}>
                  {entry.photoUri ? (
                    <Image source={{ uri: entry.photoUri }} style={styles.entryThumbImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.entryThumbPlaceholder}>
                      <Ionicons name="image-outline" size={22} color={IOSColors.secondaryLabel} />
                    </View>
                  )}
                </View>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                  <Text style={styles.entryScore}>
                    Overall: <Text style={styles.entryScoreNum}>{entry.score > 0 ? entry.score : '—'}</Text>
                  </Text>
                </View>
              </Pressable>

            </View>
          ))}
        </View>

      </ScrollView>

      {/* ── Floating action button ── */}
      <Pressable
        style={[styles.fab, { bottom: bottom + 24 }, alreadyLoggedToday && styles.fabDisabled]}
        disabled={alreadyLoggedToday}
        onPress={() => {}}
      >
        <BlurView
          intensity={alreadyLoggedToday ? 20 : 80}
          tint={alreadyLoggedToday ? 'light' : 'dark'}
          style={styles.fabInner}
        >
          <Ionicons
            name="add"
            size={20}
            color={alreadyLoggedToday ? IOSColors.secondaryLabel : '#FFFFFF'}
          />
          <Text style={[styles.fabText, alreadyLoggedToday && styles.fabTextDisabled]}>
            {alreadyLoggedToday ? 'Logged Today' : "Add Today's Entry"}
          </Text>
        </BlurView>
      </Pressable>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: IOSColors.background },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 16 },

  // Slider card
  sliderCard: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  placeholderBg: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderHint: {
    fontSize: 12,
    color: IOSColors.secondaryLabel,
  },

  // Divider
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerHandle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Corner labels
  labelDay1: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  labelGoal: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Overall progress card
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
    letterSpacing: 0.8,
  },
  progressRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressValue: {
    fontSize: 20,
    fontWeight: '700',
    color: IOSColors.label,
  },

  // Daily log
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: IOSColors.label,
    letterSpacing: 0.35,
    marginTop: 4,
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    minHeight: 88,
  },

  // Marker column
  markerCol: {
    width: 40,
    alignItems: 'center',
  },
  markerLine: {
    flex: 1,
    width: StyleSheet.hairlineWidth,
    backgroundColor: IOSColors.separator,
    minHeight: 8,
  },
  markerLineHidden: {
    backgroundColor: 'transparent',
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    backgroundColor: IOSColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerActive: {
    backgroundColor: IOSColors.fill,
    borderColor: IOSColors.fill,
  },
  markerText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
  },

  // Entry card
  entryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.subtleSeparator,
    padding: 12,
    marginVertical: 8,
  },
  entryThumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
    flexShrink: 0,
  },
  entryThumbImg: {
    width: '100%',
    height: '100%',
  },
  entryThumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryInfo: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 8,
  },
  entryDate: {
    fontSize: 12,
    fontWeight: '700',
    color: IOSColors.label,
    letterSpacing: 0.4,
  },
  entryScore: {
    fontSize: 13,
    color: IOSColors.secondaryLabel,
  },
  entryScoreNum: {
    fontWeight: '700',
    color: IOSColors.label,
    fontSize: 15,
  },

  // FAB
  fab: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: Radius.full,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  fabDisabled: {
    shadowOpacity: 0,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  fabTextDisabled: {
    color: IOSColors.secondaryLabel,
  },
});
