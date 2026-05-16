import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, Radius } from '../../../theme';
import type { FormInputProps } from './FormInput.types';

export default function FormInput({ label, value, onChangeText, placeholder }: FormInputProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.onSurfaceVariant}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.onSurface, letterSpacing: 0.1 },
  input: {
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.outline,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.onSurface,
  },
});
