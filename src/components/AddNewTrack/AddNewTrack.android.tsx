import { useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius } from '../../theme';
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

export default function AddNewTrackAndroid() {
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

  return (
    <View style={styles.root}>

      {/* ── Fullscreen Camera Modal ── */}
      <Modal visible={modalOpen} animationType="slide" statusBarTranslucent onRequestClose={handleCancel}>
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
          <View style={[styles.modalBottomBar, { paddingBottom: bottom + 24 }]}>
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
          </View>
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
              <View style={styles.changeOverlay}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
                <Text style={styles.changeOverlayText}>Tap to change</Text>
              </View>
            </>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <View style={styles.cameraIconWrap}>
                <Ionicons name="camera" size={32} color={Colors.onSurfaceVariant} />
              </View>
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
      <View style={[styles.footer, { paddingBottom: bottom + 16 }]}>
        <Pressable style={styles.noteRow} onPress={() => setAcknowledged(p => !p)}>
          <View style={[styles.checkbox, acknowledged && styles.checkboxChecked]}>
            {acknowledged && <Ionicons name="checkmark" size={12} color={Colors.onPrimary} />}
          </View>
          <Text style={styles.noteText}>
            Your initial photo serves as the permanent baseline for this issue and cannot be changed later.
          </Text>
        </Pressable>
        <PrimaryButton
          label="Generate Analysis"
          icon="sparkles"
          onPress={() => {/* navigate to analysis screen */}}
          disabled={!canGenerate}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },

  // Modal
  modalScreen: { flex: 1, backgroundColor: '#000000' },
  modalTopBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 56, paddingHorizontal: 16, zIndex: 10 },
  modalIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 32 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF' },
  previewActions: { flexDirection: 'row', width: '100%', gap: 12 },
  previewGhostBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radius.full, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  previewGhostText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radius.full, backgroundColor: '#FFFFFF' },
  confirmBtnText: { color: '#000000', fontSize: 15, fontWeight: '700' },

  // Camera card
  scroll: { flex: 1 },
  content: { padding: 16, gap: 24, paddingBottom: 8 },
  cameraCard: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md, overflow: 'hidden', borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.outline, backgroundColor: Colors.surfaceVariant },
  cameraPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  cameraIconWrap: { width: 64, height: 64, borderRadius: Radius.md, backgroundColor: Colors.outlineSubtle, alignItems: 'center', justifyContent: 'center' },
  cameraTitle: { fontSize: 18, fontWeight: '600', color: Colors.onSurface },
  cameraSub: { fontSize: 13, color: Colors.onSurfaceVariant },
  changeOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.45)' },
  changeOverlayText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Concerns content (inside SectionCard)
  sectionTitle: { fontSize: 22, fontWeight: '600', color: Colors.onSurface },
  sectionSub: { fontSize: 13, color: Colors.onSurfaceVariant },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Footer
  footer: { borderTopWidth: 1, borderTopColor: Colors.outline, paddingHorizontal: 16, paddingTop: 14, gap: 12, backgroundColor: Colors.surface },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.outline, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0, backgroundColor: '#FFFFFF' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  noteText: { flex: 1, fontSize: 12, color: Colors.onSurfaceVariant, lineHeight: 18, fontStyle: 'italic' },
});
