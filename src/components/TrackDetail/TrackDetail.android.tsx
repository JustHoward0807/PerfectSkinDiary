import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Image,
  PanResponder, Animated, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius } from '../../theme';
import { Header } from '../ui';
import { fetchIssue, fetchEntries, type IssueData, type EntryData } from '../../services/supabase/issueService';
import { trackResultStore } from '../../services/trackResultStore';
import { DEMO_ISSUE_ID } from '../../services/demoMode';
import { computeOverallScore } from '../../utils/skinScore';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

const todayIso = new Date().toISOString().split('T')[0];

// ── Component ───────────────────────────────────────────────────────────────

export default function TrackDetailAndroid() {
  const { id: issueId } = useLocalSearchParams<{ id: string }>();
  const { bottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [issue, setIssue] = useState<IssueData | null>(null);
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);

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
        <Header title="Track Detail" onBack={() => router.replace('/')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header title={issue?.title ?? 'Track Detail'} onBack={() => router.replace('/')} />

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
            <Image source={{ uri: goalImageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.placeholderBg]}>
              <Ionicons name="image-outline" size={36} color={Colors.onSurfaceVariant} />
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
                resizeMode="cover"
              />
            ) : (
              <View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: containerWidth }, styles.placeholderBg]}>
                <Ionicons name="person-outline" size={36} color={Colors.onSurfaceVariant} />
              </View>
            )}
          </Animated.View>

          {/* Layer 3: Divider */}
          <Animated.View pointerEvents="none" style={[styles.divider, { left: dividerLeftAnim }]}>
            <View style={styles.dividerHandle}>
              <Ionicons name="code" size={14} color={Colors.primary} />
            </View>
          </Animated.View>

          {/* Layer 4: Corner labels */}
          <View style={styles.labelDay1}>
            <Text style={styles.labelText}>DAY 1</Text>
          </View>
          <View style={styles.labelGoal}>
            <Ionicons name="sparkles" size={10} color="#FFFFFF" />
            <Text style={styles.labelText}> GOAL</Text>
          </View>
        </View>

        {/* ── Overall progress ── */}
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>OVERALL PROGRESS</Text>
          <View style={styles.progressRight}>
            {scoreDelta !== null ? (
              <>
                <Ionicons
                  name={scoreDelta >= 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={scoreDelta >= 0 ? Colors.primary : Colors.error}
                />
                <Text style={[styles.progressValue, scoreDelta < 0 && styles.progressNegative]}>
                  {scoreDelta >= 0 ? '+' : ''}{scoreDelta} pts
                </Text>
              </>
            ) : (
              <Text style={styles.progressDash}>Day 1</Text>
            )}
          </View>
        </View>

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
              color={Colors.onSurfaceVariant}
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
                      <Ionicons name="checkmark" size={12} color={Colors.onPrimary} />
                    ) : (
                      <Text style={styles.markerText}>{new Date(entry.entry_date).getDate()}</Text>
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
                    <Image source={{ uri: entry.photo_url }} style={styles.entryThumbImg} resizeMode="cover" />
                  </View>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryDate}>{formatDate(entry.entry_date)}</Text>
                    <Text style={styles.entryScore}>
                      Overall: <Text style={styles.entryScoreNum}>{score > 0 ? score : '—'}</Text>
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.onSurfaceVariant} />
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
        onPress={() => {}}
      >
        <Ionicons name="add" size={20} color={alreadyLoggedToday ? Colors.onSurfaceVariant : Colors.onPrimary} />
        <Text style={[styles.fabText, alreadyLoggedToday && styles.fabTextDisabled]}>
          {alreadyLoggedToday ? 'Logged Today' : "Add Today's Entry"}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: Colors.surface },
  scroll:           { flex: 1 },
  content:          { padding: 16, gap: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Slider card
  sliderCard: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceVariant,
  },
  placeholderBg: {
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderHint: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },

  // Divider
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerHandle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Corner labels
  labelDay1: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  labelGoal: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.sm,
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
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outline,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
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
    color: Colors.primary,
  },
  progressNegative: {
    color: Colors.error,
  },
  progressDash: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
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
    color: Colors.onSurface,
    letterSpacing: 0.3,
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
    width: 2,
    backgroundColor: Colors.outline,
    minHeight: 8,
  },
  markerLineHidden: { backgroundColor: 'transparent' },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.outline,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  markerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },

  // Entry card
  entryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 12,
    marginVertical: 8,
  },
  entryThumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.outlineSubtle,
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
    color: Colors.onSurface,
    letterSpacing: 0.4,
  },
  entryScore: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  entryScoreNum: {
    fontWeight: '700',
    color: Colors.onSurface,
    fontSize: 15,
  },

  // FAB
  fab: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.full,
    backgroundColor: Colors.onSurface,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabDisabled: {
    backgroundColor: Colors.surfaceVariant,
    elevation: 0,
    shadowOpacity: 0,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.surface,
    letterSpacing: 0.3,
  },
  fabTextDisabled: { color: Colors.onSurfaceVariant },
});
