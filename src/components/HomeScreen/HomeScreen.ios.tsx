import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IOSColors as C, Radius } from '../../theme';
import { supabase } from '../../services/supabase/supabase';
import { fetchUserIssues, type IssueListItem } from '../../services/supabase/issueService';
import { useWeather } from '../../hooks/useWeather';

// ── Cache ──────────────────────────────────────────────────────────────────
const _cache = new Map<string, IssueListItem[]>();

// ── Design tokens ──────────────────────────────────────────────────────────
const BORDER       = 'rgba(0,0,0,0.20)';
const BORDER_WIDTH = 1.5;
const CARD_FILL    = 'rgba(255,255,255,0.82)'; // approximates systemMaterial on light bg
const TAB_W        = 108; // straight portion of the tab
const DIAG_W       = 20;  // how far right the diagonal extends before dropping to body
const TAB_H        = 26;  // height of the tab above the card body
const TAB_R        = Radius.sm as number; // 8  — tab corner radius
const BODY_R       = Radius.md as number; // 16 — body corner radius

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCreatedDate(isoDate: string | null): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getLastEntryText(entries: { entry_date: string }[]): string {
  if (entries.length === 0) return 'No entries yet';
  const latest = entries.reduce((a, b) => a.entry_date > b.entry_date ? a : b).entry_date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - parseLocalDate(latest).getTime()) / 86_400_000);
  if (diff === 0) return 'Last entry: Today';
  if (diff === 1) return 'Last entry: Yesterday';
  if (diff < 7) return `Last entry: ${diff} days ago`;
  return `Last entry: ${parseLocalDate(latest).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// ── Folder path ────────────────────────────────────────────────────────────
//
// Traces the classic folder shape clockwise, matching the SVG icon provided:
//   • Rounded top-left corner on the tab
//   • Rounded top-right corner on the tab
//   • DIAGONAL cut from tab top-right down to body level  ← the key detail
//   • Rounded body top-right, bottom-right, bottom-left corners
//   • Single left edge shared by both tab and body (no junction)
//
//  ╭────────\
//  │  TAB    ╲
//  │           ╲────────────────────────────╮
//  │                    BODY               │
//  ╰────────────────────────────────────────╯
//
function folderPath(W: number, H: number): string {
  // Inset path by half stroke width so stroke isn't clipped at SVG canvas edges
  const s = BORDER_WIDTH / 2;
  const tW = TAB_W, dW = DIAG_W, tH = TAB_H, r = TAB_R, R = BODY_R;
  const x0 = s, y0 = s;
  const x1 = W - s, y1 = H - s;
  return [
    `M ${x0} ${y0 + r}`,
    `Q ${x0} ${y0} ${x0 + r} ${y0}`,           // tab top-left corner (rounded)
    `H ${x0 + tW}`,                             // tab top edge (straight to sharp corner)
    `L ${x0 + tW + dW} ${y0 + tH}`,            // DIAGONAL — sharp straight cut to body level
    `H ${x1 - R}`,                                         // body top edge
    `Q ${x1} ${y0 + tH} ${x1} ${y0 + tH + R}`,           // body top-right corner
    `V ${y1 - R}`,                                         // body right edge
    `Q ${x1} ${y1} ${x1 - R} ${y1}`,                      // body bottom-right corner
    `H ${x0 + R}`,                                         // body bottom edge
    `Q ${x0} ${y1} ${x0} ${y1 - R}`,                      // body bottom-left corner
    `V ${y0 + r}`,                                         // shared left edge
    `Z`,
  ].join(' ');
}

// ── FolderCard ─────────────────────────────────────────────────────────────

function FolderCard({ track }: { track: IssueListItem }) {
  const { width: screenW } = useWindowDimensions();
  const cardW = screenW - 32; // 16pt horizontal padding on each side

  // Seed with a close estimate so the border appears on the first frame
  const hasDesc = !!track.description;
  const [totalH, setTotalH] = useState(TAB_H + (hasDesc ? 142 : 98));

  return (
    <Pressable
      onPress={() => router.push(`/issue/${track.id}`)}
      style={({ pressed }) => pressed ? { opacity: 0.72 } : undefined}
    >
      <View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && h !== totalH) setTotalH(h);
        }}
      >
        {/* ── SVG: fill + border in one continuous path ── */}
        <View style={[StyleSheet.absoluteFill, { width: cardW }]} pointerEvents="none">
          <Svg width={cardW} height={totalH}>
            <Path
              d={folderPath(cardW, totalH)}
              fill={CARD_FILL}
              stroke={BORDER}
              strokeWidth={BORDER_WIDTH}
            />
          </Svg>
        </View>

        {/* ── Content sits in normal flow; paddingTop reserves the tab space ── */}
        <View style={styles.folderInner}>
          <View style={styles.crease} />
          <View style={styles.folderContent}>
            <View style={styles.topRow}>
              <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
              <Text style={styles.trackDate}>{formatCreatedDate(track.created_at)}</Text>
            </View>
            {track.description ? (
              <Text style={styles.trackDesc} numberOfLines={2}>{track.description}</Text>
            ) : null}
            <View style={styles.bottomRow}>
              <Text style={styles.lastEntry}>{getLastEntryText(track.entries)}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.fill} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ── HomeScreen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<IssueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const weather = useWeather();
  const skipFirstFocus = useRef(true);

  // Initial load — use cache if available
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        if (_cache.has(user.id)) {
          setTracks(_cache.get(user.id)!);
          setLoading(false);
          return;
        }
        const data = await fetchUserIssues(user.id);
        _cache.set(user.id, data);
        setTracks(data);
      } catch (e) {
        console.error('[HomeScreen] fetchUserIssues failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // On every return — refresh greeting + re-fetch tracks (skip first focus = initial mount)
  useFocusEffect(
    useCallback(() => {
      weather.refresh();
      if (skipFirstFocus.current) { skipFirstFocus.current = false; return; }
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          _cache.delete(user.id);
          const data = await fetchUserIssues(user.id);
          _cache.set(user.id, data);
          setTracks(data);
        } catch (e) {
          console.error('[HomeScreen] refetch failed:', e);
        }
      })();
    }, [weather.refresh]),
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greeting}>{weather.greeting}</Text>

        <Pressable onPress={() => router.push('/uv-detail')}>
          {({ pressed }) => (
            <BlurView intensity={pressed ? 90 : 70} tint="systemMaterial" style={styles.uvCard}>
              <View style={styles.uvLeft}>
                <BlurView intensity={60} tint="systemThinMaterial" style={styles.uvIconWrap}>
                  <Ionicons
                    name={!weather.loading && weather.uvIndex > 0 ? 'sunny' : 'sunny-outline'}
                    size={22}
                    color={weather.permissionDenied ? '#8E8E93' : weather.uvLevel.color}
                  />
                </BlurView>
                <View>
                  {weather.permissionDenied ? (
                    <>
                      <Text style={styles.uvTitle}>UV unavailable</Text>
                      <Text style={styles.uvSub}>Enable location in Settings</Text>
                    </>
                  ) : weather.loading ? (
                    <>
                      <Text style={styles.uvTitle}>UV —</Text>
                      <Text style={styles.uvSub}>Checking UV index...</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.uvTitle}>UV {weather.uvIndex} – {weather.uvLevel.label}</Text>
                      <Text style={styles.uvSub}>{weather.uvLevel.spfRec}</Text>
                    </>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
            </BlurView>
          )}
        </Pressable>

        <Text style={styles.sectionTitle}>Your Skin Track</Text>

        {loading ? (
          <ActivityIndicator color={C.fill} size="large" style={styles.loader} />
        ) : (
          <View style={styles.trackList}>
            {tracks.length === 0 && (
              <Text style={styles.emptyText}>No tracks yet — start your first one below.</Text>
            )}
            {tracks.map(track => (
              <FolderCard key={track.id} track={track} />
            ))}
          </View>
        )}

        <Pressable onPress={() => router.push('/new-issue')}>
          {({ pressed }) => (
            <View style={[styles.newIssueBtn, pressed && styles.newIssueBtnPressed]}>
              <Ionicons name="add" size={32} color="#8E8E93" />
              <Text style={styles.newIssueText}>Start New Track</Text>
            </View>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 20 },
  greeting: { fontSize: 34, fontWeight: '700', color: C.label, letterSpacing: 0.4 },
  loader:   { marginVertical: 32 },
  emptyText: { fontSize: 14, color: C.secondaryLabel, textAlign: 'center', marginVertical: 8 },

  // UV card
  uvCard: {
    borderRadius: Radius.md, overflow: 'hidden',
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.12)',
  },
  uvLeft:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uvIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  uvTitle: { fontSize: 16, fontWeight: '600', color: C.label },
  uvSub:   { fontSize: 13, color: C.secondaryLabel, marginTop: 2 },

  sectionTitle: { fontSize: 22, fontWeight: '700', color: C.label, letterSpacing: 0.35 },
  trackList:    { gap: 16 },

  // Folder card — content lives here, SVG is absolute behind it
  folderInner: {
    paddingTop: TAB_H,  // reserve space for the tab above the body
  },
  crease: {
    height: 1,
    backgroundColor: BORDER,
    opacity: 0.5,
    marginHorizontal: BODY_R / 2,
  },
  folderContent: { padding: 16, gap: 8 },
  topRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 8,
  },
  trackTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: C.label, lineHeight: 22 },
  trackDate:  { fontSize: 13, color: C.secondaryLabel, flexShrink: 0, lineHeight: 22 },
  trackDesc:  { fontSize: 14, color: C.secondaryLabel, lineHeight: 20 },
  bottomRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 4,
  },
  lastEntry: { fontSize: 14, fontWeight: '500', color: C.secondaryLabel },

  // New track button
  newIssueBtn: {
    borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.18)', borderRadius: Radius.md,
    paddingVertical: 24, alignItems: 'center', gap: 6,
  },
  newIssueBtnPressed: { backgroundColor: 'rgba(0,0,0,0.04)' },
  newIssueText: { fontSize: 14, fontWeight: '600', color: C.secondaryLabel },
});
