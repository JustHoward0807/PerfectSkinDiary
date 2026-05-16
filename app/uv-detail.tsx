import { View, Text, StyleSheet } from 'react-native';

export default function UVDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>UV Index</Text>
      <Text style={styles.sub}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#FDF8F3' },
  text: { fontSize: 24, fontWeight: '600', color: '#2E1F1A' },
  sub: { fontSize: 14, color: '#6B5A53' },
});
