import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  PanResponder, Animated, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOSColors, Colors, Radius } from '../../theme';
import { Header, CameraModal } from '../ui';
import { fetchIssue, fetchEntries, type IssueData, type EntryData } from '../../services/supabase/issueService';
import { trackResultStore } from '../../services/trackResultStore';
import { DEMO_ISSUE_ID } from '../../services/demoMode';
import { computeOverallScore } from '../../utils/skinScore';

// ── Helpers ────────────────────────────────────────────────────────────────

// Parse YYYY-MM-DD date strings in local time (not UTC)
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(isoDate: string): string {
  return parseLocalDate(isoDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

function localDateIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayIso = localDateIso();

// ── Component ───────────────────────────────────────────────────────────────

export default function TrackDetailIOS() {
  const { id: issueId } = useLocalSearchParams<{ id: string }>();
  const { bottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [issue, setIssue] = useState<IssueData | null>(null);
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (!issueId) return;

    // Demo mode — use local in-memory state, never touch Supabase
    if (issueId === DEMO_ISSUE_ID) {
      const demo = trackResultStore.getDemo();
      if (demo) {
        setIssue(demo.issue as IssueData);
        setEntries(demo.entries as EntryData[]);
      }
      setLoading(false);
      return;
    }

    // Use prefetched data from the generating screen if available (avoids spinner)
    const cached = trackResultStore.consumePrefetch(issueId);
    if (cached) {
      setIssue(cached.issue as IssueData);
      setEntries(cached.entries as EntryData[]);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [issueData, entriesData] = await Promise.all([
          fetchIssue(issueId),
          fetchEntries(issueId),
        ]);
        setIssue(issueData);
        setEntries(entriesData);
      } catch (e) { console.error('[TrackDetail] fetch failed:', e); }
      finally { setLoading(false); }
    })();
  }, [issueId]);

  // Re-fetch entries whenever this screen comes back into focus (e.g. after adding an entry)
  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) { isFirstMount.current = false; return; }
      if (!issueId || issueId === DEMO_ISSUE_ID) return;
      fetchEntries(issueId).then(setEntries).catch(console.error);
    }, [issueId])
  );

  // ── Slider ──
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

  // ── Derived values ──
  const alreadyLoggedToday = entries.some(e => e.entry_date === todayIso);
  const day1PhotoUri = entries[0]?.photo_url ?? null;
  const goalImageUri = issue?.goal_image_url ?? null;

  const day1Score = computeOverallScore(entries[0]?.analysis_scores);
  const latestScore = computeOverallScore(entries[entries.length - 1]?.analysis_scores);
  const scoreDelta = entries.length > 1 ? latestScore - day1Score : null;

  const sortedEntries = sortAsc ? entries : [...entries].reverse();

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title="Track Detail" onBack={() => router.dismissAll()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={IOSColors.fill} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onConfirm={(uri) => {
          setCameraOpen(false);
          router.push({ pathname: '/issue/[id]/entry/analyzing', params: { id: issueId!, photoUri: uri } });
        }}
      />

      <Header title={issue?.title ?? 'Track Detail'} onBack={() => router.dismissAll()} />

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
          {goalImageUri ? (
            <Image source={{ uri: goalImageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.placeholderBg]}>
              <Ionicons name="image-outline" size={36} color={IOSColors.secondaryLabel} />
              <Text style={styles.placeholderHint}>Goal image unavailable</Text>
            </View>
          )}

          {/* Layer 2: Day 1 photo (clipped to left portion) */}
          <Animated.View style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden',
            width: clipWidthAnim,
          }}>
            {day1PhotoUri ? (
              <Image
                source={{ uri: day1PhotoUri }}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: containerWidth }}
                contentFit="cover"
              />
            ) : (
              <View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: containerWidth }, styles.placeholderBg]}>
                <Ionicons name="person-outline" size={36} color={IOSColors.secondaryLabel} />
              </View>
            )}
          </Animated.View>

          {/* Layer 3: Divider */}
          <Animated.View pointerEvents="none" style={[styles.divider, { left: dividerLeftAnim }]}>
            <BlurView intensity={60} tint="light" style={styles.dividerHandle}>
              <Ionicons name="code" size={14} color={IOSColors.label} />
            </BlurView>
          </Animated.View>

          {/* Layer 4: Corner labels — claim the touch so the panResponder never sees it */}
          <BlurView intensity={50} tint="dark" style={styles.labelDay1} onStartShouldSetResponder={() => true}>
            <Text style={styles.labelText}>DAY 1</Text>
          </BlurView>
          <BlurView intensity={50} tint="dark" style={styles.labelGoal} onStartShouldSetResponder={() => true}>
            <Ionicons name="sparkles" size={10} color="#FFFFFF" />
            <Text style={styles.labelText}> GOAL</Text>
          </BlurView>
        </View>

        {/* ── Overall progress ── */}
        <BlurView intensity={60} tint="systemThinMaterial" style={styles.progressCard}>
          <Text style={styles.progressLabel}>OVERALL PROGRESS</Text>
          <View style={styles.progressRight}>
            {scoreDelta !== null ? (
              <>
                <Ionicons
                  name={scoreDelta >= 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={IOSColors.fill}
                />
                <Text style={styles.progressValue}>
                  {scoreDelta >= 0 ? '+' : ''}{scoreDelta} pts
                </Text>
              </>
            ) : (
              <Text style={styles.progressDash}>Day 1</Text>
            )}
          </View>
        </BlurView>

        {/* ── Daily log ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>DAILY LOG</Text>
          <Pressable
            onPress={() => setSortAsc(p => !p)}
            style={styles.sortBtn}
            hitSlop={12}
          >
            <Ionicons
              name={sortAsc ? 'arrow-up-outline' : 'arrow-down-outline'}
              size={20}
              color={IOSColors.secondaryLabel}
            />
          </Pressable>
        </View>

        <View style={styles.timeline}>
          {sortedEntries.map((entry, index) => {
            const isToday = entry.entry_date === todayIso;
            const score = computeOverallScore(entry.analysis_scores);
            return (
              <View key={entry.id} style={styles.timelineRow}>

                {/* Timeline marker */}
                <View style={styles.markerCol}>
                  <View style={[styles.markerLine, index === 0 && styles.markerLineHidden]} />
                  <View style={[styles.marker, isToday && styles.markerActive]}>
                    {isToday ? (
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.markerText}>{parseLocalDate(entry.entry_date).getDate()}</Text>
                    )}
                  </View>
                  <View style={[styles.markerLine, index === sortedEntries.length - 1 && styles.markerLineHidden]} />
                </View>

                {/* Entry card */}
                <Pressable
                  style={styles.entryCard}
                  onPress={() => router.push(`/issue/${issueId}/entry/${entry.id}`)}
                >
                  <View style={styles.entryThumb}>
                    <Image source={{ uri: entry.photo_url }} style={styles.entryThumbImg} contentFit="cover" />
                  </View>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryDate}>{formatDate(entry.entry_date)}</Text>
                    <Text style={styles.entryScore}>
                      Overall: <Text style={styles.entryScoreNum}>{score > 0 ? score : '—'}</Text>
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={IOSColors.secondaryLabel} />
                </Pressable>

              </View>
            );
          })}
        </View>

      </ScrollView>

      {/* ── Floating action button ── */}
      <Pressable
        style={[styles.fab, { bottom: bottom + 24 }, alreadyLoggedToday && styles.fabDisabled]}
        disabled={alreadyLoggedToday}
        onPress={() => setCameraOpen(true)}
      >
        {alreadyLoggedToday ? (
          <BlurView intensity={72} tint="systemMaterial" style={styles.fabInner}>
            <Ionicons name="checkmark-circle" size={20} color={IOSColors.secondaryLabel} />
            <Text style={[styles.fabText, styles.fabTextDisabled]}>Logged Today</Text>
          </BlurView>
        ) : (
          <View style={[styles.fabInner, styles.fabActive]}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.fabText}>Add Today's Entry</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: IOSColors.background },
  scroll:           { flex: 1 },
  content:          { padding: 16, gap: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  progressDash: {
    fontSize: 14,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
  },

  // Daily log
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: IOSColors.label,
    letterSpacing: 0.35,
  },
  sortBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeline: { gap: 0 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    minHeight: 88,
  },

  // Marker column
  markerCol: { width: 40, alignItems: 'center' },
  markerLine: {
    flex: 1,
    width: StyleSheet.hairlineWidth,
    backgroundColor: IOSColors.separator,
    minHeight: 8,
  },
  markerLineHidden: { backgroundColor: 'transparent' },
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
  entryThumbImg: { width: '100%', height: '100%' },
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
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  fabDisabled: {
    shadowOpacity: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  fabActive: {
    backgroundColor: Colors.primary,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  fabTextDisabled: { color: IOSColors.secondaryLabel },
});
