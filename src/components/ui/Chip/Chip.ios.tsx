import { Pressable, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { IOSColors, Radius } from '../../../theme';
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
      {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.22)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  selected: { backgroundColor: IOSColors.fill, borderColor: IOSColors.fill },
  text: { fontSize: 14, fontWeight: '600', color: IOSColors.tertiaryLabel },
  selectedText: { color: '#FFFFFF' },
});
