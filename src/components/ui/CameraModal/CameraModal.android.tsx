import { useRef, useState } from 'react';
import { View, Text, Image, Modal, Pressable, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, FlipType, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Radius } from '../../../theme';
import type { CameraModalProps } from './CameraModal.types';

export default function CameraModal({ visible, onClose, onConfirm }: CameraModalProps) {
  const { bottom } = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const handleOpen = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) { onClose(); return; }
    }
  };

  const handleCapture = async () => {
    const result = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
    if (!result?.uri) return;
    // Resize to 1500px wide before flipping — full sensor resolution (4K+) makes
    // the manipulator slow; 1500px is still plenty for YouCam HD analysis.
    const flippedRef = await ImageManipulator.manipulate(result.uri)
      .resize({ width: 1500 })
      .flip(FlipType.Horizontal)
      .renderAsync();
    const flipped = await flippedRef.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
    setPreviewUri(flipped.uri);
  };

  const handleConfirm = () => {
    if (!previewUri) return;
    onConfirm(previewUri);
    setPreviewUri(null);
  };

  const handleRetake = () => setPreviewUri(null);

  const handleClose = () => {
    setPreviewUri(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
      onShow={handleOpen}
    >
      <View style={styles.screen}>
        {!previewUri ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
        ) : (
          <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}

        <View style={styles.topBar}>
          <Pressable onPress={handleClose} style={styles.iconBtn}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: bottom + 24 }]}>
          {!previewUri ? (
            <Pressable style={styles.captureBtn} onPress={handleCapture}>
              <View style={styles.captureBtnInner} />
            </Pressable>
          ) : (
            <View style={styles.previewActions}>
              <Pressable style={styles.ghostBtn} onPress={handleRetake}>
                <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
                <Text style={styles.ghostText}>Retake</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
                <Ionicons name="checkmark" size={20} color="#000000" />
                <Text style={styles.confirmText}>Use Photo</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#000000' },
  topBar:       { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 56, paddingHorizontal: 16, zIndex: 10 },
  iconBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  bottomBar:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', paddingHorizontal: 32, paddingTop: 24 },
  captureBtn:   { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF' },
  previewActions: { flexDirection: 'row', width: '100%', gap: 12 },
  ghostBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radius.full, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  ghostText:    { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  confirmBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radius.full, backgroundColor: '#FFFFFF' },
  confirmText:  { color: '#000000', fontSize: 15, fontWeight: '700' },
});
