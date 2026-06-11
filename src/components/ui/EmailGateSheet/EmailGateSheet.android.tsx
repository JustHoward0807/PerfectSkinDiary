import { useState } from 'react';
import {
  View, Text, Modal, Pressable,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors as C, Radius } from '../../../theme';
import { signInWithGoogle, isGoogleConfigured } from '../../../hooks/useAuthLink';
import type { EmailGateSheetProps } from './EmailGateSheet.types';

export default function EmailGateSheet({ visible, onLinked, onDismiss }: EmailGateSheetProps) {
  const [loading, setLoading] = useState(false);

  const handleDismiss = () => onDismiss();

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result === 'cancelled') return;
      onLinked();
    } catch (err: unknown) {
      Alert.alert('Google Sign-In Error', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleDismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={30} color={C.onSurface} />
          </View>

          <Text style={styles.title}>Secure Your Account</Text>
          <Text style={styles.body}>
            Sign in to protect your coins and data across reinstalls and devices.
          </Text>

          {isGoogleConfigured() && (
            <Pressable
              style={[styles.socialBtn, loading && styles.btnDisabled]}
              onPress={handleGoogle}
              disabled={loading}
              android_ripple={{ color: C.outline }}
            >
              {loading ? (
                <ActivityIndicator color={C.onSurface} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#4285F4" />
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </>
              )}
            </Pressable>
          )}

          <Pressable style={styles.cancelBtn} onPress={handleDismiss} android_ripple={{ color: C.outline }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: 24, paddingBottom: 40, alignItems: 'center', elevation: 16,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: C.outline, marginBottom: 24,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.surfaceVariant, borderWidth: 1, borderColor: C.outline,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title:  { fontSize: 20, fontWeight: '700', color: C.onSurface, textAlign: 'center', marginBottom: 10 },
  body:   { fontSize: 15, color: C.onSurfaceVariant, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', minHeight: 52,
    borderWidth: 1.5, borderColor: C.outline, borderRadius: Radius.full,
    paddingVertical: 14, paddingHorizontal: 20,
    backgroundColor: C.surface,
  },
  btnDisabled:    { opacity: 0.5 },
  socialBtnText:  { fontSize: 15, fontWeight: '600', color: C.onSurface },
  cancelBtn:  { marginTop: 20, paddingVertical: 12 },
  cancelText: { fontSize: 15, color: C.onSurfaceVariant },
});
