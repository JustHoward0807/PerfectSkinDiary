import { useRef, useState, useMemo, useEffect } from 'react';
import {
  Modal, View, StyleSheet, Pressable, Text, ScrollView,
  Animated, PanResponder, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { IOSColors, Colors, Radius } from '../../../theme';
import type { PhotoFullscreenProps } from './PhotoFullscreen.types';

// ── Mask extraction ─────────────────────────────────────────────────────────

type MaskItem = { label: string; url: string };

const METRIC_LABELS: Record<string, string> = {
  hd_wrinkle: 'Wrinkle', hd_pore: 'Pore', hd_acne: 'Acne',
  hd_moisture: 'Moisture', hd_redness: 'Redness', hd_oiliness: 'Oiliness',
  hd_texture: 'Texture', hd_radiance: 'Radiance', hd_firmness: 'Firmness',
  hd_age_spot: 'Age Spot', hd_dark_circle: 'Dark Circle', hd_eye_bag: 'Eye Bag',
};
const REGION_LABELS: Record<string, string> = {
  forehead: 'Forehead', nose: 'Nose', cheek: 'Cheek', whole: '',
  glabellar: 'Glabellar', crowfeet: "Crow's Feet", periocular: 'Periocular',
  nasolabial: 'Nasolabial', marionette: 'Marionette',
};

function extractMasks(scores: unknown): MaskItem[] {
  if (typeof scores !== 'object' || scores === null) return [];
  const results: MaskItem[] = [];
  for (const [metricKey, metricVal] of Object.entries(scores as Record<string, unknown>)) {
    if (!metricKey.startsWith('hd_') || typeof metricVal !== 'object' || metricVal === null) continue;
    const metricObj = metricVal as Record<string, unknown>;
    const metricLabel = METRIC_LABELS[metricKey] ?? metricKey;
    if (typeof metricObj.output_mask_name === 'string' && metricObj.output_mask_name.startsWith('https://')) {
      results.push({ label: metricLabel, url: metricObj.output_mask_name });
      continue;
    }
    for (const [regionKey, regionVal] of Object.entries(metricObj)) {
      if (typeof regionVal !== 'object' || regionVal === null) continue;
      const regionObj = regionVal as Record<string, unknown>;
      if (typeof regionObj.output_mask_name !== 'string' || !regionObj.output_mask_name.startsWith('https://')) continue;
      const regionLabel = REGION_LABELS[regionKey] ?? regionKey;
      results.push({ label: regionLabel ? `${metricLabel} · ${regionLabel}` : metricLabel, url: regionObj.output_mask_name });
    }
  }
  return results;
}

// ── Constants ────────────────────────────────────────────────────────────────

const THUMB_SIZE = 24;
const DEFAULT_OPACITY = 0.6;
const ICON_PAD   = 32;

// ── Component ────────────────────────────────────────────────────────────────

export default function PhotoFullscreenIOS({
  visible, photoUri, score, analysisScores, onClose,
}: PhotoFullscreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();

  const [selectedMasks, setSelectedMasks] = useState<Set<string>>(new Set());
  const [maskOpacity, setMaskOpacity] = useState(DEFAULT_OPACITY);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const panelAnim       = useRef(new Animated.Value(0)).current;
  const sliderVisAnim   = useRef(new Animated.Value(0)).current;
  const toastAnim       = useRef(new Animated.Value(0)).current;
  // Refs for gesture — avoid stale closures
  const maskOpacityRef  = useRef(DEFAULT_OPACITY);
  const lastPageY       = useRef(0);
  const sliderHeightRef = useRef(0); // updated every render

  const masks    = useMemo(() => extractMasks(analysisScores), [analysisScores]);
  const hasMasks = masks.length > 0;

  const PANEL_HEIGHT  = Math.min(screenHeight * 0.52, 440);
  const SLIDER_HEIGHT = screenHeight * 0.5;
  const TRACK_HEIGHT  = SLIDER_HEIGHT - ICON_PAD * 2;
  const chipWidth     = Math.floor((screenWidth - 32 - 16) / 3);

  // Keep sliderHeightRef current on every render so PanResponder always reads the right value
  sliderHeightRef.current = TRACK_HEIGHT;

  const backdropOpacity  = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });
  const panelTranslateY  = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_HEIGHT + 20, 0] });

  // Derived slider visuals — computed from maskOpacity state
  const thumbBottom = ICON_PAD + Math.max(0, Math.min(TRACK_HEIGHT - THUMB_SIZE, maskOpacity * TRACK_HEIGHT - THUMB_SIZE / 2));
  const fillHeight  = maskOpacity * TRACK_HEIGHT;

  // ── Fade slider when selection changes ──
  useEffect(() => {
    Animated.timing(sliderVisAnim, {
      toValue: selectedMasks.size > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [selectedMasks.size]);

  // ── Reset on close ──
  useEffect(() => {
    if (!visible) {
      panelAnim.setValue(0);
      sliderVisAnim.setValue(0);
      toastAnim.setValue(0);
      setPanelOpen(false);
      setSelectedMasks(new Set());
      setMaskOpacity(DEFAULT_OPACITY);
      setToastVisible(false);
      maskOpacityRef.current = DEFAULT_OPACITY;
    }
  }, [visible]);

  // ── No-mask toast ──
  const showNoMaskToast = () => {
    toastAnim.stopAnimation();
    toastAnim.setValue(0);
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  // ── Panel ──
  const openPanel  = () => { setPanelOpen(true); Animated.spring(panelAnim, { toValue: 1, useNativeDriver: true, bounciness: 3, speed: 14 }).start(); };
  const closePanel = () => { Animated.timing(panelAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setPanelOpen(false)); };
  const togglePanel = () => { if (panelOpen) closePanel(); else openPanel(); };

  // ── Masks ──
  const toggleMask = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMasks(prev => { const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n; });
  };

  const clearAll = () => {
    setSelectedMasks(new Set());
    setMaskOpacity(DEFAULT_OPACITY);
    maskOpacityRef.current = DEFAULT_OPACITY;
  };

  // ── Vertical intensity slider ──
  // Uses incremental pageY deltas so each move is relative to the previous touch
  // position — no dependency on gs.dy baseline, no bounce.
  const vertSliderPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        lastPageY.current = e.nativeEvent.pageY;
      },
      onPanResponderMove: (e) => {
        // Incremental delta: each event is relative to the PREVIOUS touch point
        const h  = sliderHeightRef.current || 1;
        const dy = e.nativeEvent.pageY - lastPageY.current;
        lastPageY.current = e.nativeEvent.pageY;
        const v = Math.max(0, Math.min(1, maskOpacityRef.current - dy / h));
        maskOpacityRef.current = v;
        setMaskOpacity(v);
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.root, { width: screenWidth, height: screenHeight }]}>

        {/* ── Photo ── */}
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <Ionicons name="person-outline" size={52} color="rgba(255,255,255,0.3)" />
          </View>
        )}

        {/* ── Mask overlays ── */}
        {masks.map(mask => (
          <Image
            key={mask.url}
            source={{ uri: mask.url }}
            style={[StyleSheet.absoluteFill, { opacity: selectedMasks.has(mask.url) ? maskOpacity : 0 }]}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ))}

        {/* ── UI buttons (score, close, masks toggle) ── */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <BlurView intensity={55} tint="dark" style={[styles.scoreBadge, { bottom: bottom + 20 }]} pointerEvents="none">
            <Text style={styles.scoreBadgeLabel}>OVERALL</Text>
            <Text style={styles.scoreBadgeValue}>{score > 0 ? score : '—'}</Text>
          </BlurView>

          <Pressable
            style={[styles.masksBtn, { bottom: bottom + 20 }]}
            onPress={hasMasks ? togglePanel : showNoMaskToast}
            hitSlop={8}
          >
            <BlurView intensity={50} tint={panelOpen ? 'light' : 'dark'} style={[styles.masksBtnInner, !hasMasks && styles.masksBtnDisabled]}>
              <Ionicons name="layers-outline" size={30} color={panelOpen ? IOSColors.label : '#FFFFFF'} />
            </BlurView>
          </Pressable>

          <Pressable style={[styles.closeBtn, { top: top + 12 }]} onPress={onClose} hitSlop={12}>
            <BlurView intensity={60} tint="dark" style={styles.closeBtnInner}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </BlurView>
          </Pressable>
        </View>

        {/* ── Backdrop ── */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents={panelOpen ? 'auto' : 'none'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closePanel} />
        </Animated.View>

        {/* ── Vertical slider — before panel so panel always renders on top ── */}
        <Animated.View
          style={[
            styles.vertSlider,
            {
              top: screenHeight * 0.25,
              height: SLIDER_HEIGHT,
              opacity: sliderVisAnim,
            },
          ]}
          pointerEvents={selectedMasks.size > 0 ? 'auto' : 'none'}
          {...vertSliderPan.panHandlers}
        >
          <View style={styles.vertPill}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          </View>
          <View style={styles.sliderIconTop}>
            <Ionicons name="eye-outline" size={12} color="rgba(255,255,255,0.75)" />
          </View>
          <View style={styles.sliderIconBottom}>
            <Ionicons name="eye-off-outline" size={12} color="rgba(255,255,255,0.35)" />
          </View>
          <View style={styles.vertRail} />
          <View style={[styles.vertFill, { height: fillHeight }]} />
          <View style={[styles.vertThumb, { bottom: thumbBottom }]}>
            <View style={styles.thumbGrip} />
            <View style={styles.thumbGrip} />
          </View>
        </Animated.View>

        {/* ── Panel (chip grid) ── */}
        <Animated.View
          style={[styles.panel, { height: PANEL_HEIGHT, transform: [{ translateY: panelTranslateY }] }]}
          pointerEvents={panelOpen ? 'auto' : 'none'}
        >
          <View style={styles.panelClip}>
            <BlurView intensity={88} tint="systemMaterial" style={StyleSheet.absoluteFill} />
            <View style={styles.handle} />
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>SKIN MASKS</Text>
              {selectedMasks.size > 0 && (
                <Pressable onPress={clearAll} hitSlop={8}>
                  <Text style={styles.clearText}>Clear all</Text>
                </Pressable>
              )}
            </View>
            <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.panelScrollContent}>
              <View style={styles.chipGrid}>
                {masks.map(mask => {
                  const selected = selectedMasks.has(mask.url);
                  return (
                    <Pressable key={mask.url} style={[styles.chip, { width: chipWidth }, selected && styles.chipSelected]} onPress={() => toggleMask(mask.url)}>
                      {selected && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={2}>{mask.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </Animated.View>

        {/* ── No-mask toast ── */}
        {toastVisible && (
          <Animated.View style={[styles.toast, { bottom: bottom + 80, opacity: toastAnim }]} pointerEvents="none">
            <BlurView intensity={80} tint="dark" style={styles.toastInner}>
              <Text style={styles.toastText}>Mask overlay not available</Text>
            </BlurView>
          </Animated.View>
        )}

      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:        { backgroundColor: '#000' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  backdrop:    { backgroundColor: '#000' },

  scoreBadge: {
    position: 'absolute', left: 16,
    borderRadius: Radius.sm, overflow: 'hidden',
    paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center',
  },
  scoreBadgeLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.2 },
  scoreBadgeValue: { fontSize: 30, fontWeight: '300', color: '#FFFFFF', lineHeight: 34 },

  masksBtn:        { position: 'absolute', right: 16, borderRadius: Radius.sm, overflow: 'hidden' },
  masksBtnInner:   { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  masksBtnDisabled:{ opacity: 0.4 },

  toast:     { position: 'absolute', alignSelf: 'center' },
  toastInner:{ overflow: 'hidden', borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  toastText: { fontSize: 13, fontWeight: '500', color: '#FFFFFF' },

  closeBtn:     { position: 'absolute', right: 16, borderRadius: 20, overflow: 'hidden' },
  closeBtnInner:{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // ── Vertical slider ──
  vertSlider: {
    position: 'absolute',
    right: 14,
    width: 44,
  },
  vertPill: {
    position: 'absolute',
    top: 0, bottom: 0, left: 6, right: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sliderIconTop:    { position: 'absolute', top: 9, alignSelf: 'center' },
  sliderIconBottom: { position: 'absolute', bottom: 9, alignSelf: 'center' },
  vertRail: {
    position: 'absolute', top: ICON_PAD, bottom: ICON_PAD,
    alignSelf: 'center',
    width: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  vertFill: {
    position: 'absolute', bottom: ICON_PAD,
    alignSelf: 'center',
    width: 4, borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  vertThumb: {
    position: 'absolute',
    alignSelf: 'center',
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', gap: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 6,
  },
  thumbGrip: {
    width: 12, height: 1.5, borderRadius: 0.75,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },

  // ── Panel ──
  panel:    { position: 'absolute', bottom: 0, left: 0, right: 0 },
  panelClip:{ flex: 1, overflow: 'hidden', borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.2)', alignSelf: 'center', marginTop: 10, marginBottom: 14 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  panelTitle:  { fontSize: 11, fontWeight: '600', color: IOSColors.tertiaryLabel, letterSpacing: 1 },
  clearText:   { fontSize: 13, color: Colors.primary },
  panelScroll: { flex: 1 },
  panelScrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  chipGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:      { minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, borderRadius: Radius.sm, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', gap: 3 },
  chipSelected:     { backgroundColor: Colors.primary },
  chipText:         { fontSize: 11, fontWeight: '500', color: IOSColors.label, textAlign: 'center' },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
});
