import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { RadarChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius } from '../../theme';
import { Header } from '../ui';
import { fetchEntry, type EntryData } from '../../services/supabase/issueService';
import { trackResultStore } from '../../services/trackResultStore';
import { METRICS, computeOverallScore, getMetricScore } from '../../utils/skinScore';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export default function EntryDetailAndroid() {
  const { id: issueId, entryId } = useLocalSearchParams<{ id: string; entryId: string }>();
  const { bottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [entry, setEntry] = useState<EntryData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title="Entry Detail" onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.root}>
        <Header title="Entry Detail" onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Entry not found.</Text>
        </View>
      </View>
    );
  }

  const overallScore = computeOverallScore(entry.analysis_scores);
  const radarData = METRICS.map(m => getMetricScore(entry.analysis_scores, m.key));
  const radarLabels = METRICS.map(m => m.short);
  const chartSize = screenWidth - 120;

  return (
    <View style={styles.root}>
      <Header title={formatDate(entry.entry_date)} onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Photo ── */}
        <View style={styles.photoCard}>
          <Image source={{ uri: entry.photo_url }} style={styles.photo} resizeMode="cover" />
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeLabel}>OVERALL</Text>
            <Text style={styles.scoreBadgeValue}>{overallScore > 0 ? overallScore : '—'}</Text>
          </View>
        </View>

        {/* ── Radar chart ── */}
        {/* Two-layer card: surfaceVariant background clipped independently, outer is unclipped so labels render freely */}
        <View style={styles.radarCard}>
          <View style={[StyleSheet.absoluteFill, styles.radarCardBg]} />
          <Text style={styles.cardTitle}>SKIN METRICS</Text>
          <View style={styles.chartContainer}>
            <RadarChart
              data={radarData}
              labels={radarLabels}
              maxValue={100}
              chartSize={chartSize}
              noOfSections={4}
              isAnimated
              animationDuration={600}
              circular
              polygonConfig={{
                fill: 'rgba(125,90,79,0.18)',
                stroke: Colors.primary,
                strokeWidth: 2,
              }}
              gridConfig={{
                stroke: Colors.outline,
                strokeWidth: 1,
                fill: Colors.surface,
              }}
              asterLinesConfig={{
                stroke: Colors.outlineSubtle,
                strokeWidth: 0.5,
              }}
              labelsPositionOffset={10}
              labelConfig={{
                fontSize: 10,
                stroke: Colors.onSurfaceVariant,
                fontWeight: '600',
              }}
            />
          </View>
        </View>

        {/* ── Score list ── */}
        <View style={styles.listCard}>
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
        </View>

        {/* ── AI Insights ── */}
        {entry.llm_summary ? (
          <View style={styles.insightsCard}>
            <Text style={styles.cardTitle}>AI INSIGHTS</Text>
            <Text style={styles.insightsText}>{entry.llm_summary}</Text>
          </View>
        ) : null}

      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.surface },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 14 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15, color: Colors.onSurfaceVariant },

  // Photo
  photoCard: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceVariant,
  },
  photo: { width: '100%', height: '100%' },
  scoreBadge: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
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

  // Radar card — outer has NO overflow:hidden so labels render freely
  radarCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outline,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  // Inner background clipped independently for correct border radius
  radarCardBg: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceVariant,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  chartContainer: {
    alignItems: 'center',
  },

  // Score list card
  listCard: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 16,
    gap: 2,
  },

  // AI Insights card
  insightsCard: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 16,
    gap: 8,
  },
  insightsText: {
    fontSize: 14,
    color: Colors.onSurface,
    lineHeight: 21,
  },

  // Metric rows
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  metricRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineSubtle,
  },
  metricName: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.onSurfaceVariant,
    width: 82,
  },
  barContainer: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.outlineSubtle,
    borderRadius: 1,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
  metricScore: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.onSurface,
    minWidth: 26,
    textAlign: 'right',
  },
});
