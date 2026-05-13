import { useState, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Image, Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

const CONCERNS = [
  { key: 'wrinkle', label: 'Wrinkles' },
  { key: 'pores', label: 'Pores' },
  { key: 'redness', label: 'Redness' },
  { key: 'radiance', label: 'Radiance' },
  { key: 'dark_circles', label: 'Dark Circles' },
  { key: 'texture', label: 'Texture' },
  { key: 'eye_bags', label: 'Eye Bags' },
  { key: 'oiliness', label: 'Oiliness' },
  { key: 'spots', label: 'Spots' },
];

export default function AddNewTrackIOS() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [trackName, setTrackName] = useState('');
  const [selectedConcerns, setSelectedConcerns] = useState<Set<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState(false);

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setPreviewUri(null);
    setModalOpen(true);
  };

  const handleCapture = async () => {
    const result = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
    if (result?.uri) setPreviewUri(result.uri);
  };

  const handleConfirm = () => {
    setPhotoUri(previewUri);
    setAcknowledged(false);
    setModalOpen(false);
  };

  const handleRetake = () => setPreviewUri(null);

  const handleCancel = () => {
    setPreviewUri(null);
    setModalOpen(false);
  };

  const toggleConcern = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedConcerns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const canGenerate = acknowledged && photoUri !== null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Fullscreen Camera Modal ── */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalScreen}>

          {/* Camera or photo preview fills the screen */}
          {!previewUri ? (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
          ) : (
            <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}

          {/* Top bar — cancel */}
          <View style={[styles.modalTopBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={handleCancel} style={styles.modalIconBtn}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Bottom bar — capture or retake/confirm */}
          <BlurView
            intensity={60}
            tint="dark"
            style={[styles.modalBottomBar, { paddingBottom: insets.bottom + 24 }]}
          >
            {!previewUri ? (
              <Pressable style={styles.captureBtn} onPress={handleCapture}>
                <View style={styles.captureBtnInner} />
              </Pressable>
            ) : (
              <View style={styles.previewActions}>
                <Pressable style={styles.previewGhostBtn} onPress={handleRetake}>
                  <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.previewGhostText}>Retake</Text>
                </Pressable>
                <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
                  <Ionicons name="checkmark" size={20} color="#000000" />
                  <Text style={styles.confirmBtnText}>Use Photo</Text>
                </Pressable>
              </View>
            )}
          </BlurView>

        </View>
      </Modal>

      {/* ── Header — Liquid Glass ── */}
      <BlurView intensity={80} tint="systemChromeMaterial" style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </Pressable>
        <Text style={styles.headerTitle}>Start New Issue</Text>
        <View style={styles.headerSpacer} />
      </BlurView>

      {/* ── Scrollable body ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Camera / confirmed photo section */}
        <Pressable style={styles.cameraCard} onPress={openCamera}>
          {photoUri ? (
            <>
              <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <BlurView intensity={55} tint="dark" style={styles.changeOverlay}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
                <Text style={styles.changeOverlayText}>Tap to change</Text>
              </BlurView>
            </>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <BlurView intensity={60} tint="systemThinMaterial" style={styles.cameraIconWrap}>
                <Ionicons name="camera" size={32} color="#8E8E93" />
              </BlurView>
              <Text style={styles.cameraTitle}>Tap to Take Selfie</Text>
              <Text style={styles.cameraSub}>Ensure good lighting for best analysis</Text>
            </View>
          )}
        </Pressable>

        {/* Skin Track Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Skin Track Name</Text>
          <BlurView intensity={60} tint="systemMaterial" style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Forehead Texture Trial"
              placeholderTextColor="#8E8E93"
              value={trackName}
              onChangeText={setTrackName}
            />
          </BlurView>
        </View>

        {/* Target Concerns */}
        <BlurView intensity={60} tint="systemMaterial" style={styles.concernsSection}>
          <Text style={styles.concernsTitle}>Target Concerns</Text>
          <Text style={styles.concernsSub}>
            Select the areas you'd like our AI to focus on for your goal skin image.
          </Text>
          <View style={styles.chipWrap}>
            {CONCERNS.map(concern => {
              const selected = selectedConcerns.has(concern.key);
              return (
                <Pressable
                  key={concern.key}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleConcern(concern.key)}
                >
                  {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {concern.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </BlurView>
      </ScrollView>

      {/* ── Footer — Liquid Glass ── */}
      <BlurView
        intensity={80}
        tint="systemChromeMaterial"
        style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
      >
        <Pressable style={styles.noteRow} onPress={() => setAcknowledged(prev => !prev)}>
          <View style={[styles.checkbox, acknowledged && styles.checkboxChecked]}>
            {acknowledged && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
          </View>
          <Text style={styles.noteText}>
            Your initial photo serves as the permanent baseline for this issue and cannot be changed later.
          </Text>
        </Pressable>

        <Pressable
          style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
          disabled={!canGenerate}
          onPress={() => {/* navigate to analysis screen */}}
        >
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          <Text style={styles.generateBtnText}>Generate Analysis</Text>
        </Pressable>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },

  // ── Modal ──
  modalScreen: { flex: 1, backgroundColor: '#000000' },
  modalTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  modalIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
    overflow: 'hidden',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  previewGhostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  previewGhostText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: '#FFFFFF',
  },
  confirmBtnText: { color: '#000000', fontSize: 15, fontWeight: '700' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.18)',
    overflow: 'hidden',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000000', letterSpacing: 0.35 },
  headerSpacer: { width: 40 },

  // ── Scroll ──
  scroll: { flex: 1 },
  content: { padding: 16, gap: 24, paddingBottom: 8 },

  // ── Camera card ──
  cameraCard: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.22)',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cameraIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: { fontSize: 18, fontWeight: '600', color: '#000000', letterSpacing: 0.35 },
  cameraSub: { fontSize: 13, color: '#8E8E93' },
  changeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  changeOverlayText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // ── Input ──
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#000000', letterSpacing: 0.1 },
  inputWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
  },

  // ── Concerns ──
  concernsSection: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    padding: 16,
    gap: 10,
  },
  concernsTitle: { fontSize: 22, fontWeight: '700', color: '#000000', letterSpacing: 0.35 },
  concernsSub: { fontSize: 13, color: '#8E8E93' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.22)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  chipSelected: { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#3C3C43' },
  chipTextSelected: { color: '#FFFFFF' },

  // ── Footer ──
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
    overflow: 'hidden',
  },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  checkboxChecked: { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' },
  noteText: { flex: 1, fontSize: 12, color: '#8E8E93', lineHeight: 18, fontStyle: 'italic' },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1C1C1E',
    paddingVertical: 16,
    borderRadius: 9999,
  },
  generateBtnDisabled: { backgroundColor: 'rgba(0,0,0,0.18)' },
  generateBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
