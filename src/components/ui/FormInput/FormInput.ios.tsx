import { View, Text, TextInput, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { IOSColors, Radius } from '../../../theme';
import type { FormInputProps } from './FormInput.types';

export default function FormInput({ label, value, onChangeText, placeholder }: FormInputProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <BlurView intensity={60} tint="systemMaterial" style={styles.wrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={IOSColors.secondaryLabel}
        />
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: IOSColors.label, letterSpacing: 0.1 },
  wrap: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: IOSColors.label,
  },
});
