import { Pressable, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius } from '../../../theme';
import type { PrimaryButtonProps } from './PrimaryButton.types';

export default function PrimaryButton({ label, onPress, disabled, icon }: PrimaryButtonProps) {
  return (
    <Pressable
      style={[styles.btn, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon && <Ionicons name={icon as any} size={18} color={Colors.onPrimary} />}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: Radius.full,
  },
  disabled: { backgroundColor: Colors.outlineSubtle },
  label: { fontSize: 16, fontWeight: '600', color: Colors.onPrimary },
});
