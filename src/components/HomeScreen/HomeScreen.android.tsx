import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors as C, Radius } from '../../theme';

const TRACKS = [
  { id: '1', title: 'Acne Track', description: 'Targeting breakouts on chin area', day: 14 },
  { id: '2', title: 'Hydration Track', description: 'Dry patches on cheeks', day: 3 },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.greeting}>Good Morning</Text>

      <Pressable onPress={() => router.push('/uv-detail')}>
        {({ pressed }) => (
          <View style={[styles.uvCard, pressed && styles.uvCardPressed]}>
            <View style={styles.uvLeft}>
              <View style={styles.uvIconWrap}>
                <Ionicons name="sunny-outline" size={22} color={C.onSurfaceVariant} />
              </View>
              <View>
                <Text style={styles.uvTitle}>UV 6 – High</Text>
                <Text style={styles.uvSub}>SPF 30+ recommended today</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.onSurfaceVariant} />
          </View>
        )}
      </Pressable>

      <Text style={styles.sectionTitle}>Your Skin Track</Text>

      <View style={styles.trackList}>
        {TRACKS.map(track => (
          <Pressable key={track.id}>
            <View style={styles.trackCard}>
              <View style={styles.trackImageWrap}>
                <Ionicons name="image-outline" size={36} color={C.outline} />
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>Day {track.day}</Text>
                </View>
              </View>
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle}>{track.title}</Text>
                <Text style={styles.trackDesc}>{track.description}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => router.push('/new-issue')}>
        {({ pressed }) => (
          <View style={[styles.newIssueBtn, pressed && styles.newIssueBtnPressed]}>
            <Ionicons name="add" size={32} color={C.onSurfaceVariant} />
            <Text style={styles.newIssueText}>Start New Track</Text>
          </View>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.surface },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
  greeting: { fontSize: 30, fontWeight: '700', color: C.onSurface, lineHeight: 40 },
  uvCard: {
    backgroundColor: C.surfaceVariant,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.outline,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uvCardPressed: { backgroundColor: C.outlineSubtle },
  uvLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uvIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.outlineSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uvTitle: { fontSize: 16, fontWeight: '600', color: C.onSurface },
  uvSub: { fontSize: 13, color: C.onSurfaceVariant, marginTop: 2 },
  sectionTitle: { fontSize: 22, fontWeight: '600', color: C.onSurface },
  trackList: { gap: 16 },
  trackCard: {
    backgroundColor: C.surfaceVariant,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.outline,
    overflow: 'hidden',
  },
  trackImageWrap: {
    height: 140,
    backgroundColor: C.outlineSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: C.onSurface,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dayBadgeText: { color: C.onPrimary, fontSize: 12, fontWeight: '600' },
  trackInfo: { padding: 12 },
  trackTitle: { fontSize: 14, fontWeight: '600', color: C.onSurface },
  trackDesc: { fontSize: 13, color: C.onSurfaceVariant, marginTop: 2 },
  newIssueBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.outline,
    borderRadius: Radius.md,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  newIssueBtnPressed: { backgroundColor: C.surfaceVariant },
  newIssueText: { fontSize: 14, fontWeight: '600', color: C.onSurfaceVariant },
});
