import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { IOSColors, Radius } from '../../../theme';
import type { SectionCardProps } from './SectionCard.types';

export default function SectionCard({ children }: SectionCardProps) {
  return (
    <BlurView intensity={60} tint="systemMaterial" style={styles.card}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.subtleSeparator,
    padding: 16,
    gap: 10,
  },
});
