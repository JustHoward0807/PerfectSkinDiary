import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Header } from '../ui';
import { Colors as C, Radius } from '../../theme';
import { APP_VERSION, COPYRIGHT_YEAR } from '../../constants/version';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function FeatureCard({ icon, title, description }: { icon: IoniconName; title: string; description: string }) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={24} color={C.primary} />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{description}</Text>
    </View>
  );
}

export default function AboutScreen() {
  return (
    <View style={styles.root}>
      <Header title="What's this app" />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          <Text style={styles.heading}>What's this app?</Text>
          <Text style={styles.intro}>
            PerfectSkinDiary is an AI-powered skin tracking journal that helps you visualise and
            achieve your personal skincare goals. By combining daily photo analysis with
            clinical-grade AI, we give you a calm space to reflect on your skin's journey — and
            share that record with your dermatologist when you're ready.
          </Text>

          {/* Feature cards */}
          <View style={styles.grid}>
            <FeatureCard
              icon="pulse-outline"
              title="Clinical-Grade Analysis"
              description="Powered by Perfect Corp's YouCam technology, your daily selfies are analysed across 16 skin metrics — hydration, texture, pores, redness, and more — tracked objectively over time."
            />
            <FeatureCard
              icon="bulb-outline"
              title="Intelligent Insights"
              description="With Claude AI integrated, your skin scores and AM/PM routine are synthesised into plain-language insights so you can see which products are actually moving the needle."
            />
            <FeatureCard
              icon="image-outline"
              title="Goal Image"
              description="On Day 1, AI Skin Simulation generates a photorealistic goal image of what your skin could look like after targeted improvement — your fixed north star for the entire tracking journey."
            />
            <FeatureCard
              icon="document-text-outline"
              title="Dermatologist Export"
              description="Select any entries and export a structured PDF for your dermatologist — photos, analysis overlays, metric scores, and Claude's summary, ordered chronologically."
            />
          </View>

          <Text style={styles.footer}>© {COPYRIGHT_YEAR} PerfectSkinDiary • {APP_VERSION}</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32, gap: 20 },

  heading: { fontSize: 28, fontWeight: '700', color: C.primary, lineHeight: 36 },
  intro: { fontSize: 16, color: C.onSurfaceVariant, lineHeight: 26 },

  grid: { gap: 12 },
  featureCard: {
    backgroundColor: C.surfaceVariant, borderRadius: Radius.md,
    borderWidth: 1, borderColor: C.outline, padding: 20, gap: 8,
  },
  featureIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { fontSize: 16, fontWeight: '600', color: C.onSurface },
  featureBody: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 22 },

  footer: { fontSize: 12, color: C.onSurfaceVariant, textAlign: 'center', marginTop: 8 },
});
