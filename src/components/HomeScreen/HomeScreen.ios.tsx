import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IOSColors as C, Radius } from '../../theme';

const TRACKS = [
  { id: '1', title: 'Acne Track', description: 'Targeting breakouts on chin area', day: 14 },
  { id: '2', title: 'Hydration Track', description: 'Dry patches on cheeks', day: 3 },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greeting}>Good Morning</Text>

        <Pressable onPress={() => router.push('/uv-detail')}>
          {({ pressed }) => (
            <BlurView
              intensity={pressed ? 90 : 70}
              tint="systemMaterial"
              style={styles.uvCard}
            >
              <View style={styles.uvLeft}>
                <BlurView intensity={60} tint="systemThinMaterial" style={styles.uvIconWrap}>
                  <Ionicons name="sunny-outline" size={22} color="#FF9F0A" />
                </BlurView>
                <View>
                  <Text style={styles.uvTitle}>UV 6 – High</Text>
                  <Text style={styles.uvSub}>SPF 30+ recommended today</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
            </BlurView>
          )}
        </Pressable>

        <Text style={styles.sectionTitle}>Your Skin Track</Text>

        <View style={styles.trackList}>
          {TRACKS.map(track => (
            <Pressable key={track.id}>
              {({ pressed }) => (
                <BlurView
                  intensity={pressed ? 90 : 70}
                  tint="systemMaterial"
                  style={styles.trackCard}
                >
                  <View style={styles.trackImageWrap}>
                    <Ionicons name="image-outline" size={36} color="#C7C7CC" />
                    <BlurView intensity={85} tint="dark" style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>Day {track.day}</Text>
                    </BlurView>
                  </View>
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle}>{track.title}</Text>
                    <Text style={styles.trackDesc}>{track.description}</Text>
                  </View>
                </BlurView>
              )}
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => router.push('/new-issue')}>
          {({ pressed }) => (
            <View style={[styles.newIssueBtn, pressed && styles.newIssueBtnPressed]}>
              <Ionicons name="add" size={32} color="#8E8E93" />
              <Text style={styles.newIssueText}>Start New Track</Text>
            </View>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 20 },
  greeting: { fontSize: 34, fontWeight: '700', color: C.label, letterSpacing: 0.4 },
  uvCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  uvLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uvIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uvTitle: { fontSize: 16, fontWeight: '600', color: C.label },
  uvSub: { fontSize: 13, color: C.secondaryLabel, marginTop: 2 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: C.label, letterSpacing: 0.35 },
  trackList: { gap: 14 },
  trackCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  trackImageWrap: {
    height: 140,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: Radius.full,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dayBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  trackInfo: { padding: 14 },
  trackTitle: { fontSize: 14, fontWeight: '600', color: C.label },
  trackDesc: { fontSize: 13, color: C.secondaryLabel, marginTop: 2 },
  newIssueBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.18)',
    borderRadius: Radius.md,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  newIssueBtnPressed: { backgroundColor: 'rgba(0,0,0,0.04)' },
  newIssueText: { fontSize: 14, fontWeight: '600', color: C.secondaryLabel },
});
