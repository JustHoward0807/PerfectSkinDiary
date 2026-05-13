import { Pressable, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors, Radius } from '../../../theme';
import type { ChipProps } from './Chip.types';

export default function Chip({ label, selected, onPress }: ChipProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      style={[styles.chip, selected && styles.selected]}
      onPress={handlePress}
    >
      {selected && <Ionicons name="checkmark" size={14} color={Colors.onPrimary} />}
      <Text style={[styles.text, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.outline,
    backgroundColor: '#FFFFFF',
  },
  selected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  text: { fontSize: 14, fontWeight: '600', color: Colors.onSurfaceVariant },
  selectedText: { color: Colors.onPrimary },
});
