import { View, StyleSheet } from 'react-native';
import { Colors, Radius } from '../../../theme';
import type { SectionCardProps } from './SectionCard.types';

export default function SectionCard({ children }: SectionCardProps) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 16,
    gap: 10,
  },
});
