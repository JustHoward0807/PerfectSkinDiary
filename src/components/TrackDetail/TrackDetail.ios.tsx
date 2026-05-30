import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, TextInput,
  PanResponder, Animated, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOSColors, Colors, Radius } from '../../theme';
import { Header, CameraModal, ComparisonFullscreen } from '../ui';
import { fetchIssue, fetchEntries, fetchProducts, addProduct, removeProduct, deleteIssueAndEntries, type IssueData, type EntryData, type Product } from '../../services/supabase/issueService';
import { useWallet } from '../../hooks/useWallet';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [amExpanded, setAmExpanded] = useState(false);
  const [pmExpanded, setPmExpanded] = useState(false);
  const [amInput, setAmInput] = useState('');
  const [pmInput, setPmInput] = useState('');
  const [productSaving, setProductSaving] = useState(false);
  const isFirstMount = useRef(true);

  const handleDelete = () => {
    if (issueId === DEMO_ISSUE_ID) return;
    Alert.alert(
      'Delete Track',
      'This action cannot be undone. The track, all its entries, and the goal image will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteIssueAndEntries(issueId!);
              router.dismissAll();
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
        const [issueData, entriesData, productsData] = await Promise.all([
          fetchIssue(issueId),
          fetchEntries(issueId),
          fetchProducts(issueId),
        ]);
        setIssue(issueData);
        setEntries(entriesData);
        setProducts(productsData);
      } catch (e) { console.error('[TrackDetail] fetch failed:', e); }
      finally { setLoading(false); }
    })();
  }, [issueId]);

  // Re-fetch entries and products whenever this screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) { isFirstMount.current = false; return; }
      if (!issueId || issueId === DEMO_ISSUE_ID) return;
      Promise.all([fetchEntries(issueId), fetchProducts(issueId)])
        .then(([e, p]) => { setEntries(e); setProducts(p); })
        .catch(console.error);
    }, [issueId])
  );

  const handleAddProduct = async (routine: 'am' | 'pm') => {
    const name = (routine === 'am' ? amInput : pmInput).trim();
    if (!name || !issueId) return;
    setProductSaving(true);
    try {
      const newProduct = await addProduct(issueId, name, routine);
      setProducts(prev => [...prev, newProduct]);
      if (routine === 'am') { setAmInput(''); setAmExpanded(false); }
      else { setPmInput(''); setPmExpanded(false); }
    } catch { Alert.alert('Error', 'Could not add product.'); }
    finally { setProductSaving(false); }
  };

  const handleRemoveProduct = async (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
    try { await removeProduct(productId); } catch { /* best-effort */ }
  };

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
  const { balance, isInTrial } = useWallet();
  const goalImageUri = issue?.goal_image_url ?? null;

  const day1Score = computeOverallScore(entries[0]?.analysis_scores);
  const latestScore = computeOverallScore(entries[entries.length - 1]?.analysis_scores);
  const scoreDelta = entries.length > 1 ? latestScore - day1Score : null;

  const sortedEntries = sortAsc ? entries : [...entries].reverse();

  const deleteBtn = issueId !== DEMO_ISSUE_ID ? (
    <Pressable onPress={handleDelete} disabled={deleting} hitSlop={8} style={styles.deleteBtn}>
      <Ionicons name="trash-outline" size={22} color="#FF3B30" />
    </Pressable>
  ) : null;

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title="Track Detail" onBack={() => router.dismissAll()} trailing={deleteBtn} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={IOSColors.fill} size="large" />
        </View>
        {deleting && <View style={styles.deletingOverlay}><ActivityIndicator size="large" color="#FFFFFF" /></View>}
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

      <ComparisonFullscreen
        visible={fullscreenOpen}
        day1Uri={day1PhotoUri}
        goalUri={goalImageUri}
        onClose={() => setFullscreenOpen(false)}
      />

      <Header title={issue?.title ?? 'Track Detail'} onBack={() => router.dismissAll()} trailing={deleteBtn} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 96 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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

          {/* Fullscreen button — bottom-right */}
          <Pressable
            style={styles.fullscreenBtn}
            onPress={() => setFullscreenOpen(true)}
            hitSlop={8}
          >
            <BlurView intensity={50} tint="dark" style={styles.fullscreenBtnInner}>
              <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
            </BlurView>
          </Pressable>
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

        {/* ── AM / PM Routine ── */}
        {(['am', 'pm'] as const).map(routine => {
          const isAm = routine === 'am';
          const expanded = isAm ? amExpanded : pmExpanded;
          const input = isAm ? amInput : pmInput;
          const setExpanded = isAm ? setAmExpanded : setPmExpanded;
          const setInput = isAm ? setAmInput : setPmInput;
          const routineProducts = products.filter(p => p.routine === routine);
          return (
            <BlurView key={routine} intensity={60} tint="systemThinMaterial" style={styles.routineCard}>
              <View style={styles.routineHeader}>
                <Text style={styles.routineTitle}>{isAm ? 'AM' : 'PM'} ROUTINE</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => { setExpanded(e => !e); if (!expanded) setInput(''); }}
                >
                  <Ionicons
                    name={expanded ? 'close-circle-outline' : 'add-circle-outline'}
                    size={22}
                    color={IOSColors.fill}
                  />
                </Pressable>
              </View>
              {routineProducts.length === 0 && !expanded && (
                <Text style={styles.routineEmpty}>No products added yet</Text>
              )}
              {routineProducts.map(p => (
                <View key={p.id} style={styles.productRow}>
                  <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                  <Pressable hitSlop={8} onPress={() => handleRemoveProduct(p.id)}>
                    <Ionicons name="close" size={16} color={IOSColors.secondaryLabel} />
                  </Pressable>
                </View>
              ))}
              {expanded && (
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.productInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Product name…"
                    placeholderTextColor={IOSColors.secondaryLabel}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => handleAddProduct(routine)}
                  />
                  <Pressable
                    style={[styles.addBtn, (!input.trim() || productSaving) && styles.addBtnDisabled]}
                    onPress={() => handleAddProduct(routine)}
                    disabled={!input.trim() || productSaving}
                  >
                    <Text style={styles.addBtnText}>Add</Text>
                  </Pressable>
                </View>
              )}
            </BlurView>
          );
        })}

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
                  onPress={() => router.push({
                    pathname: `/issue/${issueId}/entry/${entry.id}`,
                    params: { isDay1: entry.id === entries[0]?.id ? '1' : '0' },
                  })}
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

      {deleting && <View style={styles.deletingOverlay}><ActivityIndicator size="large" color="#FFFFFF" /></View>}

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
            <View>
              <Text style={styles.fabText}>Add Today's Entry</Text>
              {!isInTrial && balance !== null && (
                <View style={styles.fabSubRow}>
                  <Text style={styles.fabSubText}>{balance}</Text>
                  <Ionicons name="ellipse" size={10} color="#FFD700" />
                  <Text style={styles.fabSubText}>available  ·  −1 per entry</Text>
                </View>
              )}
            </View>
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
  deleteBtn:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  deletingOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 99 },

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

  // Routine card
  routineCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
    letterSpacing: 0.8,
  },
  routineEmpty: {
    fontSize: 13,
    color: IOSColors.secondaryLabel,
    fontStyle: 'italic',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 2,
  },
  productName: {
    flex: 1,
    fontSize: 14,
    color: IOSColors.label,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  productInput: {
    flex: 1,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    paddingHorizontal: 10,
    fontSize: 14,
    color: IOSColors.label,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  addBtn: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: Radius.sm,
    backgroundColor: IOSColors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
  fabSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  fabSubText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
  },
});
