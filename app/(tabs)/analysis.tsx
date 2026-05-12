import { View, Text, StyleSheet } from 'react-native';

export default function AnalysisScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Analysis</Text>
      <Text style={styles.sub}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  text: { fontSize: 24, fontWeight: '600' },
  sub: { fontSize: 14, color: '#6B5A53' },
});
