import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IOSColors } from '../../../theme';
import type { HeaderProps } from './Header.types';

export default function Header({ title, onBack }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const handleBack = onBack ?? (() => router.back());

  return (
    <BlurView
      intensity={80}
      tint="systemChromeMaterial"
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <Pressable style={styles.backBtn} onPress={handleBack}>
        <Ionicons name="arrow-back" size={24} color={IOSColors.label} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
    </BlurView>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
    overflow: 'hidden',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: IOSColors.label, textAlign: 'center', letterSpacing: 0.35 },
  spacer: { width: 40 },
});
