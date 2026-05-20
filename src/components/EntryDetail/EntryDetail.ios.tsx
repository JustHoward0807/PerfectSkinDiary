import { useEffect, useState, memo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, Pressable, Alert,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { RadarChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IOSColors, Radius } from '../../theme';
import { Header, PhotoFullscreen } from '../ui';
import { fetchEntry, deleteEntry, type EntryData } from '../../services/supabase/issueService';
import { trackResultStore } from '../../services/trackResultStore';
import { METRICS, computeOverallScore, getMetricScore } from '../../utils/skinScore';

// ── Helpers ────────────────────────────────────────────────────────────────

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(isoDate: string): string {
  return parseLocalDate(isoDate).toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Typewriter card — isolated so its state updates never re-render the parent ──

const TypewriterInsights = memo(({ summary }: { summary: string }) => {
  const [displayed, setDisplayed] = useState('');
  const [typing, setTyping] = useState(false);
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    setDisplayed('');
    setTyping(true);
    let i = 0;
    let interval: ReturnType<typeof setInterval>;
    const delay = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setDisplayed(summary.slice(0, i));
        if (i >= summary.length) { clearInterval(interval); setTyping(false); }
      }, 0);
    }, 300);
    return () => { clearTimeout(delay); clearInterval(interval); };
  }, [summary]);

  useEffect(() => {
    if (!typing) { setCursorOn(false); return; }
    const t = setInterval(() => setCursorOn(v => !v), 500);
    return () => clearInterval(t);
  }, [typing]);

  return (
    <BlurView intensity={50} tint="systemUltraThinMaterial" style={styles.insightsCard}>
      <Text style={styles.cardTitle}>AI INSIGHTS</Text>
      <Text style={styles.insightsText}>
        {displayed}
        {typing ? <Text style={styles.cursor}>{cursorOn ? '|' : ' '}</Text> : null}
      </Text>
    </BlurView>
  );
});

// ── Component ───────────────────────────────────────────────────────────────

export default function EntryDetailIOS() {
  const { entryId, isDay1 } = useLocalSearchParams<{ id: string; entryId: string; isDay1?: string }>();
  const { bottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [entry, setEntry] = useState<EntryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    if (!entryId || !entry || entryId.startsWith('demo-')) return;
    Alert.alert(
      'Delete Entry',
      'This entry will be permanently deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteEntry(entryId, entry.photo_url);
              router.back();
            } catch (e) {
              setDeleting(false);
              Alert.alert('Delete failed', e instanceof Error ? e.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (!entryId) return;

    // Demo mode — resolve from in-memory store, no network call
    if (entryId.startsWith('demo-')) {
      const demo = trackResultStore.getDemo();
      const demoEntry = demo?.entries.find(e => e.id === entryId);
      if (demoEntry) setEntry(demoEntry as EntryData);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await fetchEntry(entryId);
        setEntry(data);
      } catch (e) { console.error('[EntryDetail] fetch failed:', e); }
      finally { setLoading(false); }
    })();
  }, [entryId]);

  const isDemoEntry = entryId?.startsWith('demo-') ?? false;
  const isFirstEntry = isDay1 === '1';
  const deleteBtn = !isDemoEntry && !isFirstEntry ? (
    <Pressable onPress={handleDelete} disabled={deleting} hitSlop={8} style={styles.deleteBtn}>
      <Ionicons name="trash-outline" size={22} color="#FF3B30" />
    </Pressable>
  ) : null;

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title="Entry Detail" onBack={() => router.back()} trailing={deleteBtn} />
        <View style={styles.center}>
          <ActivityIndicator color={IOSColors.fill} size="large" />
        </View>
        {deleting && <View style={styles.deletingOverlay}><ActivityIndicator size="large" color="#FFFFFF" /></View>}
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.root}>
        <Header title="Entry Detail" onBack={() => router.back()} trailing={deleteBtn} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Entry not found.</Text>
        </View>
        {deleting && <View style={styles.deletingOverlay}><ActivityIndicator size="large" color="#FFFFFF" /></View>}
      </View>
    );
  }

  const overallScore = computeOverallScore(entry.analysis_scores);
  const radarData = METRICS.map(m => getMetricScore(entry.analysis_scores, m.key));
  const radarLabels = METRICS.map(m => m.short);
  // Smaller than full card width so labels have clear space around the circle
  const chartSize = screenWidth - 100;

  return (
    <View style={styles.root}>
      <Header title={formatDate(entry.entry_date)} onBack={() => router.back()} trailing={deleteBtn} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Photo ── */}
        <View style={styles.photoCard}>
          <Image source={{ uri: entry.photo_url }} style={styles.photo} resizeMode="cover" />
          <BlurView intensity={55} tint="dark" style={styles.scoreBadge} pointerEvents="none">
            <Text style={styles.scoreBadgeLabel}>OVERALL</Text>
            <Text style={styles.scoreBadgeValue}>{overallScore > 0 ? overallScore : '—'}</Text>
          </BlurView>
          <Pressable style={styles.fullscreenBtn} onPress={() => setFullscreenOpen(true)} hitSlop={8}>
            <BlurView intensity={50} tint="dark" style={styles.fullscreenBtnInner}>
              <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
            </BlurView>
          </Pressable>
        </View>

        <PhotoFullscreen
          visible={fullscreenOpen}
          photoUri={entry.photo_url}
          score={overallScore}
          analysisScores={entry.analysis_scores}
          onClose={() => setFullscreenOpen(false)}
        />

        {/* ── AI Insights ── */}
        {entry.llm_summary ? <TypewriterInsights summary={entry.llm_summary} /> : null}

        {/* ── Radar chart ── */}
        {/* Two-layer card: clipped blur background + unclipped content so labels never get cut off */}
        <View style={styles.radarCard}>
          <View style={[StyleSheet.absoluteFill, styles.radarCardBg]}>
            <BlurView intensity={50} tint="systemUltraThinMaterial" style={StyleSheet.absoluteFill} />
          </View>
          <Text style={styles.cardTitle}>SKIN METRICS</Text>
          <View style={styles.chartContainer}>
            <RadarChart
              data={radarData}
              labels={radarLabels}
              maxValue={100}
              chartSize={chartSize}
              noOfSections={4}
              isAnimated
              animationDuration={700}
              circular
              polygonConfig={{
                fill: 'rgba(125,90,79,0.18)',
                stroke: '#7D5A4F',
                strokeWidth: 2,
              }}
              gridConfig={{
                stroke: 'rgba(0,0,0,0.14)',
                strokeWidth: 1,
                fill: 'rgba(255,255,255,0.55)',
              }}
              asterLinesConfig={{
                stroke: 'rgba(0,0,0,0.08)',
                strokeWidth: 0.5,
              }}
              labelsPositionOffset={10}
              labelConfig={{
                fontSize: 10,
                stroke: 'rgba(0,0,0,0.55)',
                fontWeight: '600',
              }}
            />
            
          </View>
        </View>

        {/* ── Score list ── */}
        <BlurView intensity={50} tint="systemUltraThinMaterial" style={styles.listCard}>
          <Text style={styles.cardTitle}>ALL METRICS</Text>
          {METRICS.map((metric, i) => {
            const score = getMetricScore(entry.analysis_scores, metric.key);
            return (
              <View
                key={metric.key}
                style={[styles.metricRow, i < METRICS.length - 1 && styles.metricRowBorder]}
              >
                <Text style={styles.metricName}>{metric.label}</Text>
                <View style={styles.barContainer}>
                  <View style={[styles.barFill, { width: `${score}%` }]} />
                </View>
                <Text style={styles.metricScore}>{score > 0 ? score : '—'}</Text>
              </View>
            );
          })}
        </BlurView>


      </ScrollView>

      {deleting && <View style={styles.deletingOverlay}><ActivityIndicator size="large" color="#FFFFFF" /></View>}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: IOSColors.background },
  scroll:    { flex: 1 },
  content:   { padding: 16, gap: 14 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15, color: IOSColors.secondaryLabel },
  deleteBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  deletingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 99 },

  // Photo
  photoCard: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  photo: { width: '100%', height: '100%' },
  scoreBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  fullscreenBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  fullscreenBtnInner: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBadgeLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.2,
  },
  scoreBadgeValue: {
    fontSize: 30,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 34,
  },

  // Radar card — outer has NO overflow:hidden so labels are never clipped
  radarCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.subtleSeparator,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  // Inner blur background is clipped independently for correct border radius
  radarCardBg: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: IOSColors.tertiaryLabel,
    letterSpacing: 1,
  },
  chartContainer: {
    alignItems: 'center',
  },

  // Score list card
  listCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.subtleSeparator,
    padding: 16,
    gap: 2,
  },

  // AI Insights card
  insightsCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.subtleSeparator,
    padding: 16,
    gap: 8,
  },
  insightsText: {
    fontSize: 14,
    color: IOSColors.label,
    lineHeight: 21,
  },
  cursor: {
    fontSize: 14,
    color: IOSColors.fill,
    fontWeight: '300',
  },

  // Metric rows
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  metricRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.subtleSeparator,
  },
  metricName: {
    fontSize: 13,
    fontWeight: '400',
    color: IOSColors.secondaryLabel,
    width: 82,
  },
  barContainer: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.07)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: IOSColors.fill,
    borderRadius: 1,
  },
  metricScore: {
    fontSize: 12,
    fontWeight: '600',
    color: IOSColors.label,
    minWidth: 26,
    textAlign: 'right',
  },
});
