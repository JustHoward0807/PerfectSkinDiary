import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../../src/theme';
import { trackResultStore } from '../../../src/services/trackResultStore';
import { PrimaryButton } from '../../../src/components/ui';

export default function TrackDetailScreen() {
  const { analysisResult, trackName } = trackResultStore.get();

  // score_info.json may have different shapes depending on the API version.
  // We render a readable table for any array of objects that have a numeric score field,
  // and always print the full raw JSON below for inspection.
  const scoreList = extractScoreList(analysisResult);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Track Detail</Text>
      {trackName ? <Text style={styles.trackName}>{trackName}</Text> : null}

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>SCORE INFO (score_info.json)</Text>

      {scoreList.length > 0 ? (
        scoreList.map((row, i) => (
          <View key={i} style={styles.scoreRow}>
            <Text style={styles.scoreType}>{row.label}</Text>
            <Text style={styles.scoreValue}>{row.value}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.hint}>No score entries parsed — see raw JSON below.</Text>
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>RAW JSON</Text>
      <Text style={styles.raw}>{JSON.stringify(analysisResult, null, 2)}</Text>

      <View style={styles.divider} />

      <PrimaryButton label="Back to Home" onPress={() => router.replace('/')} />
    </ScrollView>
  );
}

// ── Flexible score extractor ──
// Works regardless of whether score_info.json is a flat object, { output: [] }, etc.
function extractScoreList(data: unknown): { label: string; value: string }[] {
  if (!data || typeof data !== 'object') return [];

  // Shape A: { output: [{ type, ui_score, raw_score }, ...] }
  const asOutputArr = (data as Record<string, unknown>).output;
  if (Array.isArray(asOutputArr)) {
    return asOutputArr.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return [];
      const e = entry as Record<string, unknown>;
      const label = String(e.type ?? e.name ?? '?');
      const ui = e.ui_score ?? e.score ?? e.value;
      const raw = e.raw_score;
      const value = raw !== undefined
        ? `ui: ${ui}  raw: ${Number(raw).toFixed(2)}`
        : String(ui ?? '—');
      return [{ label, value }];
    });
  }

  // Shape B: flat key → number object  { hd_wrinkle: 72, hd_pore: 88, ... }
  const entries = Object.entries(data as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'number' || typeof v === 'string');
  if (entries.length > 0) {
    return entries.map(([k, v]) => ({ label: k, value: String(v) }));
  }

  return [];
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.surface },
  content:      { padding: 16, gap: 12, paddingBottom: 40 },
  heading:      { fontSize: 24, fontWeight: '700', color: Colors.onSurface },
  trackName:    { fontSize: 16, color: Colors.onSurfaceVariant },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.primary, letterSpacing: 0.8 },
  divider:      { height: 1, backgroundColor: Colors.outline },
  scoreRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.outlineSubtle },
  scoreType:    { fontSize: 13, color: Colors.onSurface, fontWeight: '500', flex: 1 },
  scoreValue:   { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  hint:         { fontSize: 13, color: Colors.onSurfaceVariant, fontStyle: 'italic' },
  raw:          { fontSize: 11, color: Colors.onSurfaceVariant, lineHeight: 17, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
