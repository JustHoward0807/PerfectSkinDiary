import { useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IOSColors, Radius } from '../../theme';
import { Header, FormInput, Chip, SectionCard, PrimaryButton } from '../ui';

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
  const { bottom } = useSafeAreaInsets();
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
    setSelectedConcerns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const canGenerate = acknowledged && photoUri !== null;

  const handleGenerate = () => {
    const concerns = selectedConcerns.size === 0
      ? CONCERNS.map(c => c.key)
      : Array.from(selectedConcerns);
    router.push({
      pathname: '/new-issue/generating',
      params: { photoUri: photoUri!, concerns: JSON.stringify(concerns), trackName },
    });
  };

  return (
    <View style={styles.root}>

      {/* ── Fullscreen Camera Modal ── */}
      <Modal visible={modalOpen} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalScreen}>
          {!previewUri ? (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
          ) : (
            <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
          <View style={styles.modalTopBar}>
            <Pressable onPress={handleCancel} style={styles.modalIconBtn}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
          <BlurView intensity={60} tint="dark" style={[styles.modalBottomBar, { paddingBottom: bottom + 24 }]}>
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

      {/* ── Header ── */}
      <Header title="Start New Issue" onBack={() => router.back()} />

      {/* ── Scrollable body ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Camera / confirmed photo */}
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
                <Ionicons name="camera" size={32} color={IOSColors.secondaryLabel} />
              </BlurView>
              <Text style={styles.cameraTitle}>Tap to Take Selfie</Text>
              <Text style={styles.cameraSub}>Ensure good lighting for best analysis</Text>
            </View>
          )}
        </Pressable>

        {/* Track name */}
        <FormInput
          label="Skin Track Name"
          value={trackName}
          onChangeText={setTrackName}
          placeholder="e.g., Forehead Texture Trial"
        />

        {/* Target concerns */}
        <SectionCard>
          <Text style={styles.sectionTitle}>Target Concerns</Text>
          <Text style={styles.sectionSub}>
            Select the areas you'd like our AI to focus on for your goal skin image.
          </Text>
          <View style={styles.chipWrap}>
            {CONCERNS.map(c => (
              <Chip
                key={c.key}
                label={c.label}
                selected={selectedConcerns.has(c.key)}
                onPress={() => toggleConcern(c.key)}
              />
            ))}
          </View>
        </SectionCard>
      </ScrollView>

      {/* ── Footer ── */}
      <BlurView intensity={80} tint="systemChromeMaterial" style={[styles.footer, { paddingBottom: bottom + 16 }]}>
        <Pressable style={styles.noteRow} onPress={() => setAcknowledged(p => !p)}>
          <View style={[styles.checkbox, acknowledged && styles.checkboxChecked]}>
            {acknowledged && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
          </View>
          <Text style={styles.noteText}>
            Your initial photo serves as the permanent baseline for this issue and cannot be changed later.
          </Text>
        </Pressable>
        <PrimaryButton
          label="Generate Analysis"
          icon="sparkles"
          onPress={handleGenerate}
          disabled={!canGenerate}
        />
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.background },

  // Modal
  modalScreen: { flex: 1, backgroundColor: '#000000' },
  modalTopBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 56, paddingHorizontal: 16, zIndex: 10 },
  modalIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  modalBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 32, paddingTop: 24, overflow: 'hidden' },
  captureBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF' },
  previewActions: { flexDirection: 'row', width: '100%', gap: 12 },
  previewGhostBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.5)' },
  previewGhostText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radius.full, backgroundColor: '#FFFFFF' },
  confirmBtnText: { color: '#000000', fontSize: 15, fontWeight: '700' },

  // Camera card
  scroll: { flex: 1 },
  content: { padding: 16, gap: 24, paddingBottom: 8 },
  cameraCard: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.22)', backgroundColor: 'rgba(0,0,0,0.04)' },
  cameraPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  cameraIconWrap: { width: 64, height: 64, borderRadius: Radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cameraTitle: { fontSize: 18, fontWeight: '600', color: IOSColors.label, letterSpacing: 0.35 },
  cameraSub: { fontSize: 13, color: IOSColors.secondaryLabel },
  changeOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, overflow: 'hidden' },
  changeOverlayText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Concerns content (inside SectionCard)
  sectionTitle: { fontSize: 22, fontWeight: '700', color: IOSColors.label, letterSpacing: 0.35 },
  sectionSub: { fontSize: 13, color: IOSColors.secondaryLabel },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Footer
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: IOSColors.separator, paddingHorizontal: 16, paddingTop: 14, gap: 12, overflow: 'hidden' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.22)', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.6)' },
  checkboxChecked: { backgroundColor: IOSColors.fill, borderColor: IOSColors.fill },
  noteText: { flex: 1, fontSize: 12, color: IOSColors.secondaryLabel, lineHeight: 18, fontStyle: 'italic' },
});
