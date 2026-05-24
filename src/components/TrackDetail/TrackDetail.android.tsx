import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, TextInput,
  PanResponder, Animated, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius } from '../../theme';
import { Header, CameraModal, ComparisonFullscreen } from '../ui';
import { fetchIssue, fetchEntries, fetchProducts, addProduct, removeProduct, deleteIssueAndEntries, type IssueData, type EntryData, type Product } from '../../services/supabase/issueService';
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

export default function TrackDetailAndroid() {
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
  const goalImageUri = issue?.goal_image_url ?? null;

  const day1Score = computeOverallScore(entries[0]?.analysis_scores);
  const latestScore = computeOverallScore(entries[entries.length - 1]?.analysis_scores);
  const scoreDelta = entries.length > 1 ? latestScore - day1Score : null;

  const sortedEntries = sortAsc ? entries : [...entries].reverse();

  const deleteBtn = issueId !== DEMO_ISSUE_ID ? (
    <Pressable
      onPress={handleDelete}
      disabled={deleting}
      hitSlop={8}
      style={styles.deleteBtn}
      android_ripple={{ color: 'rgba(155,62,40,0.15)', radius: 20 }}
    >
      <Ionicons name="trash-outline" size={22} color={Colors.error} />
    </Pressable>
  ) : null;

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title="Track Detail" onBack={() => router.dismissAll()} trailing={deleteBtn} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
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
                contentFit="cover"
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

          {/* Layer 4: Corner labels — claim the touch so the panResponder never sees it */}
          <View style={styles.labelDay1} onStartShouldSetResponder={() => true}>
            <Text style={styles.labelText}>DAY 1</Text>
          </View>
          <View style={styles.labelGoal} onStartShouldSetResponder={() => true}>
            <Ionicons name="sparkles" size={10} color="#FFFFFF" />
            <Text style={styles.labelText}> GOAL</Text>
          </View>

          {/* Fullscreen button — bottom-right */}
          <Pressable
            style={styles.fullscreenBtn}
            onPress={() => setFullscreenOpen(true)}
            hitSlop={8}
            android_ripple={{ color: 'rgba(255,255,255,0.2)', radius: 15 }}
          >
            <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
          </Pressable>
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

        {/* ── AM / PM Routine ── */}
        {(['am', 'pm'] as const).map(routine => {
          const isAm = routine === 'am';
          const expanded = isAm ? amExpanded : pmExpanded;
          const input = isAm ? amInput : pmInput;
          const setExpanded = isAm ? setAmExpanded : setPmExpanded;
          const setInput = isAm ? setAmInput : setPmInput;
          const routineProducts = products.filter(p => p.routine === routine);
          return (
            <View key={routine} style={styles.routineCard}>
              <View style={styles.routineHeader}>
                <Text style={styles.routineTitle}>{isAm ? 'AM' : 'PM'} ROUTINE</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => { setExpanded(e => !e); if (!expanded) setInput(''); }}
                  android_ripple={{ color: 'rgba(0,0,0,0.1)', radius: 16 }}
                >
                  <Ionicons
                    name={expanded ? 'close-circle-outline' : 'add-circle-outline'}
                    size={22}
                    color={Colors.primary}
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
                    <Ionicons name="close" size={16} color={Colors.onSurfaceVariant} />
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
                    placeholderTextColor={Colors.onSurfaceVariant}
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
            </View>
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
                  <Ionicons name="chevron-forward" size={16} color={Colors.onSurfaceVariant} />
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
  deleteBtn:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, overflow: 'hidden' },
  deletingOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 99 },

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
  fullscreenBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
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

  // Routine card
  routineCard: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outline,
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
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.8,
  },
  routineEmpty: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
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
    color: Colors.onSurface,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  productInput: {
    flex: 1,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.outline,
    paddingHorizontal: 10,
    fontSize: 14,
    color: Colors.onSurface,
    backgroundColor: Colors.surface,
  },
  addBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.onPrimary,
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
