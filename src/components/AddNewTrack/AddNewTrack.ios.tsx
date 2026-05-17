import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IOSColors, Radius } from '../../theme';
import { Header, FormInput, Chip, SectionCard, PrimaryButton, CameraModal } from '../ui';
import { isDemoMode, activateDemoMode } from '../../services/demoMode';

const CONCERNS = [
  { key: 'acne',         label: 'Acne' },
  { key: 'dark_circles', label: 'Dark Circles' },
  { key: 'eye_bags',     label: 'Eye Bags' },
  { key: 'oiliness',     label: 'Oiliness' },
  { key: 'pores',        label: 'Pores' },
  { key: 'radiance',     label: 'Radiance' },
  { key: 'redness',      label: 'Redness' },
  { key: 'spots',        label: 'Spots' },
  { key: 'texture',      label: 'Texture' },
  { key: 'wrinkle',      label: 'Wrinkles' },
];

export default function AddNewTrackIOS() {
  const { bottom } = useSafeAreaInsets();

  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [trackName, setTrackName] = useState('');
  const [selectedConcerns, setSelectedConcerns] = useState<Set<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState(false);

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
    if (isDemoMode(trackName, selectedConcerns)) {
      activateDemoMode(trackName);
      router.replace('/issue/demo');
      return;
    }
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

      <CameraModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onConfirm={(uri) => { setPhotoUri(uri); setAcknowledged(false); }}
      />

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
        <Pressable style={styles.cameraCard} onPress={() => setCameraOpen(true)}>
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
