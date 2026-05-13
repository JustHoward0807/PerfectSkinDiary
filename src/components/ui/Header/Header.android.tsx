import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../../theme';
import type { HeaderProps } from './Header.types';

export default function Header({ title, onBack }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Pressable style={styles.backBtn} onPress={handleBack}>
        <Ionicons name="arrow-back" size={24} color={Colors.onSurface} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.onSurface, textAlign: 'center' },
  spacer: { width: 40 },
});
