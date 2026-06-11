import { Pressable, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IOSColors, Radius } from '../../../theme';
import type { PrimaryButtonProps } from './PrimaryButton.types';

export default function PrimaryButton({ label, onPress, disabled, icon }: PrimaryButtonProps) {
  return (
    <Pressable
      style={[styles.btn, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon && <Ionicons name={icon as any} size={18} color="#FFFFFF" />}
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
    backgroundColor: IOSColors.fill,
    paddingVertical: 16,
    borderRadius: Radius.full,
  },
  disabled: { backgroundColor: 'rgba(0,0,0,0.18)' },
  label: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
