import { useState } from 'react';
import {
  View, Text, Modal, Pressable,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as AppleAuthentication from 'expo-apple-authentication';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IOSColors, Radius } from '../../../theme';
import { signInWithGoogle, signInWithApple, isGoogleConfigured } from '../../../hooks/useAuthLink';
import type { EmailGateSheetProps } from './EmailGateSheet.types';

export default function EmailGateSheet({ visible, onLinked, onDismiss }: EmailGateSheetProps) {
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);

  const handleDismiss = () => onDismiss();
  const isIdle = loading === null;

  const handleApple = async () => {
    setLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
      await signInWithApple(credential.identityToken);
      onLinked();
    } catch (err: unknown) {
      if (err instanceof Error && (err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Apple Sign-In Error', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setLoading('google');
    try {
      const result = await signInWithGoogle();
      if (result === 'cancelled') return;
      onLinked();
    } catch (err: unknown) {
      Alert.alert('Google Sign-In Error', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleDismiss} />
        <BlurView intensity={80} tint="systemChromeMaterial" style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={30} color={IOSColors.label} />
          </View>

          <Text style={styles.title}>Secure Your Account</Text>
          <Text style={styles.body}>
            Sign in to protect your coins and data across reinstalls and devices.
          </Text>

          {/* Apple Sign In — primary on iOS */}
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={Radius.full}
            style={[styles.appleBtn, !isIdle && styles.btnDisabled]}
            onPress={handleApple}
          />

          {/* Google Sign In */}
          {isGoogleConfigured() && (
            <Pressable
              style={[styles.socialBtn, !isIdle && styles.btnDisabled]}
              onPress={handleGoogle}
              disabled={!isIdle}
            >
              {loading === 'google' ? (
                <ActivityIndicator color={IOSColors.label} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#4285F4" />
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </>
              )}
            </Pressable>
          )}

          <Pressable style={styles.cancelBtn} onPress={handleDismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    overflow: 'hidden', padding: 24, paddingBottom: 44, alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: IOSColors.separator,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: IOSColors.secondaryLabel, opacity: 0.4, marginBottom: 24,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.07)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title:  { fontSize: 20, fontWeight: '700', color: IOSColors.label, textAlign: 'center', marginBottom: 10 },
  body:   { fontSize: 15, color: IOSColors.secondaryLabel, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  appleBtn:   { width: '100%', height: 52, marginBottom: 10 },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth, borderColor: IOSColors.separator,
    borderRadius: Radius.full, paddingVertical: 14, paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  btnDisabled:   { opacity: 0.5 },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: IOSColors.label },
  cancelBtn:  { marginTop: 20, paddingVertical: 12 },
  cancelText: { fontSize: 15, color: IOSColors.secondaryLabel },
});
