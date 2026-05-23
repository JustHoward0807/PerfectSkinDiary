import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { fetchRecentEntries, type RecentEntry } from '../../src/services/supabase/issueService';
import { generateSkinPdf, sharePdfFile } from '../../src/services/pdf/exportPdf';
import { extractScores, type ExtractedScores } from '../../src/services/pdf/scoreExtractor';
import { Colors, Radius } from '../../src/theme';
import { PrimaryButton } from '../../src/components/ui';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function shortDate(iso: string): string {
  const d = parseLocal(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// Per-date deduplication: keep the entry with the highest overall score for each date.
// Multiple tracks can produce multiple entries on the same calendar day; the chart
// needs exactly one data point per date.
function deduplicateByDate(raw: RecentEntry[]): RecentEntry[] {
  const map = new Map<string, RecentEntry>();
  for (const entry of raw) {
    const prev = map.get(entry.entry_date);
    if (!prev) {
      map.set(entry.entry_date, entry);
    } else {
      const prevScore  = extractScores(prev.analysis_scores).overall ?? 0;
      const thisScore  = extractScores(entry.analysis_scores).overall ?? 0;
      if (thisScore > prevScore) map.set(entry.entry_date, entry);
    }
  }
  return [...map.values()].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
}

// ─── Concern config ───────────────────────────────────────────────────────────

type ConcernKey = keyof ExtractedScores;

interface ConcernConfig {
  key: ConcernKey;
  label: string;
  statusLabel: (score: number) => string;
}

const CONCERNS: ConcernConfig[] = [
  {
    key: 'moisture',
    label: 'MOISTURE',
    statusLabel: s => s >= 80 ? 'Good' : s >= 65 ? 'Fair' : 'Low',
  },
  {
    key: 'redness',
    label: 'REDNESS',
    statusLabel: s => s >= 80 ? 'Minimal' : s >= 65 ? 'Mild' : 'Elevated',
  },
  {
    key: 'pores',
    label: 'PORES',
    statusLabel: s => s >= 80 ? 'Refined' : s >= 65 ? 'Visible' : 'Enlarged',
  },
  {
    key: 'texture',
    label: 'TEXTURE',
    statusLabel: s => s >= 80 ? 'Smooth' : s >= 65 ? 'Slight' : 'Rough',
  },
  {
    key: 'acne',
    label: 'ACNE',
    statusLabel: s => s >= 80 ? 'Minimal' : s >= 65 ? 'Moderate' : 'Active',
  },
  {
    key: 'oiliness',
    label: 'OILINESS',
    statusLabel: s => s >= 80 ? 'Balanced' : s >= 65 ? 'Moderate' : 'Oily',
  },
];

// ─── Concern card ─────────────────────────────────────────────────────────────

interface ConcernCardProps {
  config: ConcernConfig;
  score: number | null;
  delta: number | null;
}

function ConcernCard({ config, score, delta }: ConcernCardProps) {
  const hasScore = score != null;
  const statusText = hasScore ? config.statusLabel(score!) : '—';

  let arrowName: React.ComponentProps<typeof Ionicons>['name'] = 'arrow-forward';
  let arrowColor = '#8E8E93';
  if (delta != null) {
    if (delta > 2)  { arrowName = 'trending-up';   arrowColor = '#2d8f6f'; }
    if (delta < -2) { arrowName = 'trending-down';  arrowColor = '#c0473e'; }
  }

  const barFill = hasScore ? score! / 100 : 0;

  return (
    <View style={cStyles.card}>
      <View style={cStyles.topRow}>
        <Text style={cStyles.label}>{config.label}</Text>
        <Ionicons name={arrowName} size={16} color={arrowColor} />
      </View>
      <Text style={cStyles.status}>{statusText}</Text>
      <View style={cStyles.track}>
        <View style={[cStyles.bar, { flex: barFill }]} />
        <View style={{ flex: 1 - barFill }} />
      </View>
    </View>
  );
}

const cStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Platform.OS === 'ios' ? '#fff' : Colors.surfaceVariant,
    borderRadius: Radius.md,
    padding: 14,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Platform.OS === 'ios' ? '#8E8E93' : Colors.onSurfaceVariant,
  },
  status: {
    fontSize: 20,
    fontWeight: '600',
    color: Platform.OS === 'ios' ? '#000' : Colors.onSurface,
  },
  track: {
    flexDirection: 'row',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  bar: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
});

// ─── iOS PDF viewer modal ─────────────────────────────────────────────────────

interface PdfModalProps {
  uri: string | null;
  onClose: () => void;
}

function PdfViewerModal({ uri, onClose }: PdfModalProps) {
  const { top } = useSafeAreaInsets();
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (!uri) return;
    setSharing(true);
    try {
      await sharePdfFile(uri);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal visible={!!uri} animationType="slide" presentationStyle="fullScreen">
      <View style={pdfStyles.container}>
        <View style={[pdfStyles.header, { paddingTop: top + 12 }]}>
          <TouchableOpacity onPress={onClose} style={pdfStyles.headerBtn} hitSlop={8}>
            <Text style={pdfStyles.doneText}>Done</Text>
          </TouchableOpacity>

          <Text style={pdfStyles.headerTitle} numberOfLines={1}>Skin Progress Report</Text>

          <TouchableOpacity onPress={handleShare} style={pdfStyles.headerBtn} hitSlop={8} disabled={sharing}>
            {sharing
              ? <ActivityIndicator size="small" color="#007AFF" />
              : <Ionicons name="share-outline" size={22} color="#007AFF" />
            }
          </TouchableOpacity>
        </View>

        {uri && (
          <WebView
            source={{ uri }}
            allowFileAccess
            style={pdfStyles.webview}
            originWhitelist={['file://*', 'about:*']}
          />
        )}
      </View>
    </Modal>
  );
}

const pdfStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#525659' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  headerBtn: { minWidth: 60 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  doneText: { fontSize: 17, color: '#007AFF' },
  webview: { flex: 1 },
});

// ─── Analysis screen ──────────────────────────────────────────────────────────

type DayOption = 3 | 5 | 10;
const DAY_OPTIONS: DayOption[] = [3, 5, 10];

export default function AnalysisScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<DayOption>(5);
  const [exporting, setExporting] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Fetch 30 raw entries to ensure ≥10 unique dates after deduplication
    // (users with multiple active tracks can have several entries per calendar day)
    fetchRecentEntries(user.id, 30)
      .then(raw => setEntries(deduplicateByDate(raw)))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleExport() {
    if (!user) return;
    setExporting(true);
    try {
      const uri = await generateSkinPdf(user.id);
      if (Platform.OS === 'ios') {
        setPdfUri(uri);
      } else {
        await sharePdfFile(uri);
      }
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  }

  // Slice the most recent N entries; entries are already ascending by date
  const displayedEntries = entries.slice(-selectedDays);

  // Chart data
  const chartData = displayedEntries.map(e => ({
    value: extractScores(e.analysis_scores).overall ?? 0,
    label: shortDate(e.entry_date),
  }));
  const avgScore = chartData.length > 0
    ? Math.round(chartData.reduce((s, p) => s + p.value, 0) / chartData.length)
    : null;

  // Concern grid data
  const firstScores = displayedEntries.length > 0 ? extractScores(displayedEntries[0].analysis_scores) : null;
  const lastScores  = displayedEntries.length > 0 ? extractScores(displayedEntries[displayedEntries.length - 1].analysis_scores) : null;

  // Chart width = screen - paddingH(32) - cardPadding(32) - yAxis(~38)
  const chartWidth = screenWidth - 32 - 32 - 38;

  const hasEntries = entries.length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 60 }]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <Text style={styles.title}>Analysis</Text>

        {/* Day selector */}
        <View style={styles.selector}>
          {DAY_OPTIONS.map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.selectorPill, selectedDays === d && styles.selectorPillActive]}
              onPress={() => setSelectedDays(d)}
              activeOpacity={0.75}
            >
              <Text style={[styles.selectorText, selectedDays === d && styles.selectorTextActive]}>
                {d} Days
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.centred}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : !hasEntries ? (
          <View style={styles.emptyCard}>
            <Ionicons name="camera-outline" size={40} color={Colors.onSurfaceVariant} />
            <Text style={styles.emptyTitle}>No entries yet</Text>
            <Text style={styles.emptyBody}>
              Start your first skin track and add at least one photo entry to see your trends.
            </Text>
          </View>
        ) : (
          <>
            {/* Skin Score Trend card */}
            <View style={styles.scoreCard}>
              <View style={styles.scoreHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scoreTitle}>Skin Score Trend</Text>
                  <Text style={styles.scoreSubtitle}>Overall progress based on logs</Text>
                </View>
                {avgScore != null && (
                  <View style={styles.avgBlock}>
                    <Text style={styles.avgBig}>
                      {avgScore}
                      <Text style={styles.avgUnit}>/100</Text>
                    </Text>
                    <Text style={styles.avgLabel}>Avg. Score</Text>
                  </View>
                )}
              </View>

              {chartData.length === 0 ? (
                <View style={styles.noDataBox}>
                  <Ionicons name="bar-chart-outline" size={28} color="#C7C7CC" />
                  <Text style={styles.noDataText}>No data available</Text>
                </View>
              ) : (
                <LineChart
                  key={selectedDays}
                  data={chartData}
                  curved
                  areaChart
                  isAnimated
                  animationDuration={1000}
                  color={Colors.primary}
                  thickness={2.5}
                  startFillColor={Colors.primary}
                  endFillColor={Colors.primary}
                  startOpacity={0.18}
                  endOpacity={0.02}
                  dataPointsColor={Colors.primary}
                  dataPointsRadius={4}
                  yAxisTextStyle={{ fontSize: 10, color: '#8E8E93' }}
                  xAxisLabelTextStyle={{ fontSize: 10, color: '#8E8E93' }}
                  noOfSections={4}
                  maxValue={100}
                  initialSpacing={16}
                  endSpacing={16}
                  rulesColor="rgba(0,0,0,0.06)"
                  rulesType="solid"
                  yAxisColor="transparent"
                  xAxisColor="rgba(0,0,0,0.08)"
                  width={chartWidth}
                  height={140}
                  pointerConfig={{
                    showPointerStrip: true,
                    pointerStripWidth: 1.5,
                    pointerStripHeight: 140,
                    pointerStripColor: 'rgba(0,0,0,0.15)',
                    stripOverPointer: true,
                    pointerColor: Colors.primary,
                    radius: 6,
                    pointerLabelWidth: 72,
                    pointerLabelHeight: 52,
                    autoAdjustPointerLabelPosition: true,
                    persistPointer: false,
                    pointerLabelComponent: (items: Array<{ value: number; label: string }>) => (
                      <View style={styles.pointerLabel}>
                        <Text style={styles.pointerScore}>{items[0].value}</Text>
                        <Text style={styles.pointerDate}>{items[0].label}</Text>
                      </View>
                    ),
                  }}
                />
              )}
            </View>

            {/* Concerns grid — 2 cards per row */}
            <Text style={styles.sectionTitle}>Skin Concerns</Text>
            <View style={styles.concernsGrid}>
              {[0, 2, 4].map(rowStart => (
                <View key={rowStart} style={styles.concernsRow}>
                  {CONCERNS.slice(rowStart, rowStart + 2).map(c => {
                    const score = lastScores ? (lastScores[c.key] as number | null) : null;
                    const firstScore = firstScores ? (firstScores[c.key] as number | null) : null;
                    const delta = score != null && firstScore != null ? score - firstScore : null;
                    return (
                      <ConcernCard key={c.key} config={c} score={score} delta={delta} />
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Export PDF */}
            {exporting ? (
              <View style={styles.exportingRow}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.exportingText}>Preparing PDF…</Text>
              </View>
            ) : (
              <PrimaryButton
                label="Export PDF Report"
                icon="document-outline"
                onPress={handleExport}
              />
            )}
          </>
        )}
      </ScrollView>

      {/* Fill the system navigation bar area with the background colour on Android */}
      {Platform.OS === 'android' && insets.bottom > 0 && (
        <View style={{ height: insets.bottom, backgroundColor: Colors.surface }} />
      )}

      {Platform.OS === 'ios' && (
        <PdfViewerModal uri={pdfUri} onClose={() => setPdfUri(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Platform.OS === 'ios' ? '#F2F2F7' : Colors.surface,
  },
  content: {
    paddingHorizontal: 16,
    gap: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: Platform.OS === 'ios' ? '#000' : Colors.onSurface,
  },

  // Day selector
  selector: {
    flexDirection: 'row',
    backgroundColor: Platform.OS === 'ios' ? '#fff' : Colors.surfaceVariant,
    borderRadius: Radius.md,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  selectorPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  selectorPillActive: {
    backgroundColor: Colors.primary,
  },
  selectorText: {
    fontSize: 13,
    fontWeight: '500',
    color: Platform.OS === 'ios' ? '#8E8E93' : Colors.onSurfaceVariant,
  },
  selectorTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // Loading / empty
  centred: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyCard: {
    backgroundColor: Platform.OS === 'ios' ? '#fff' : Colors.surfaceVariant,
    borderRadius: Radius.md,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Platform.OS === 'ios' ? '#000' : Colors.onSurface,
  },
  emptyBody: {
    fontSize: 13,
    color: Platform.OS === 'ios' ? '#8E8E93' : Colors.onSurfaceVariant,
    textAlign: 'center',
  },

  // Score trend card
  scoreCard: {
    backgroundColor: Platform.OS === 'ios' ? '#fff' : Colors.surfaceVariant,
    borderRadius: Radius.md,
    padding: 16,
    gap: 14,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Platform.OS === 'ios' ? '#000' : Colors.onSurface,
  },
  scoreSubtitle: {
    fontSize: 12,
    color: Platform.OS === 'ios' ? '#8E8E93' : Colors.onSurfaceVariant,
    marginTop: 2,
  },
  avgBlock: {
    alignItems: 'flex-end',
  },
  avgBig: {
    fontSize: 28,
    fontWeight: '700',
    color: Platform.OS === 'ios' ? '#000' : Colors.onSurface,
  },
  avgUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: Platform.OS === 'ios' ? '#8E8E93' : Colors.onSurfaceVariant,
  },
  avgLabel: {
    fontSize: 11,
    color: Platform.OS === 'ios' ? '#8E8E93' : Colors.onSurfaceVariant,
  },

  // Concerns
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Platform.OS === 'ios' ? '#000' : Colors.onSurface,
    marginBottom: -8,
  },
  concernsGrid: {
    gap: 12,
  },
  concernsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // No-data placeholder (same height as the chart)
  noDataBox: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noDataText: {
    fontSize: 13,
    color: '#C7C7CC',
  },

  // Pointer tooltip
  pointerLabel: {
    backgroundColor: Platform.OS === 'ios' ? '#fff' : Colors.surfaceVariant,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pointerScore: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  pointerDate: {
    fontSize: 10,
    color: Platform.OS === 'ios' ? '#8E8E93' : Colors.onSurfaceVariant,
    marginTop: 1,
  },

  // Export
  exportingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  exportingText: {
    fontSize: 14,
    color: Colors.primary,
  },
});
