import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Header } from '../ui';
import { Colors as C, Radius } from '../../theme';
import { APP_VERSION, COPYRIGHT_YEAR } from '../../constants/version';

const CONTACT_EMAIL = 'howardongdev0807@gmail.com';
const LAST_UPDATED  = 'May 20, 2026';

function SectionHeading({ children }: { children: string }) {
  return <Text style={styles.sectionHeading}>{children}</Text>;
}

function SubHeading({ children }: { children: string }) {
  return <Text style={styles.subHeading}>{children}</Text>;
}

function Body({ children }: { children: string }) {
  return <Text style={styles.body}>{children}</Text>;
}

export default function PrivacyScreen() {
  return (
    <View style={styles.root}>
      <Header title="Privacy Policy" />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Intro */}
          <View style={styles.introSection}>
            <Text style={styles.lastUpdated}>Last Updated: {LAST_UPDATED}</Text>
            <Body>
              At PerfectSkinDiary, we prioritise your privacy and are committed to protecting the
              deeply personal information you share with us. This policy details how we handle your
              data, specifically focusing on the photos and biometric information vital to your
              skincare tracking journey.
            </Body>
          </View>

          {/* Biometric data highlight card */}
          <View style={styles.biometricCard}>
            <View style={styles.biometricHeader}>
              <Ionicons name="scan-outline" size={22} color={C.primary} />
              <Text style={styles.biometricTitle}>Photo &amp; Biometric Data Handling</Text>
            </View>

            <SubHeading>1. Collection and Processing</SubHeading>
            <Body>
              To provide personalised skin analysis, we collect the selfies you upload within the app.
              These images are securely transmitted to the Perfect Corp YouCam API for real-time
              processing. This analysis extracts skin health data points (e.g. texture, redness,
              hydration levels) and returns numerical scores — no photo is retained by Perfect Corp
              beyond the analysis request.
            </Body>

            <SubHeading>2. AI Interpretation</SubHeading>
            <Body>
              Numerical skin scores and your AM/PM skincare routine (product names only) are sent to
              the Anthropic Claude API to generate a plain-language summary. Your photos are never
              sent to Claude — only the scored metrics and routine text.
            </Body>

            <SubHeading>3. Secure Storage</SubHeading>
            <Body>
              Your photos and the resulting biometric scores are stored in Supabase, a US-based cloud
              platform. Data is protected in transit via HTTPS and at rest by Supabase's
              industry-standard cloud security. As the app developer, we have administrative access to
              this storage solely for operational support purposes.
            </Body>

            <SubHeading>4. Strict Usage Limits</SubHeading>
            <Body>
              Your biometric data and photos are used solely to facilitate your personal skincare
              tracking journey within PerfectSkinDiary. We do not sell, rent, or share your biometric
              data with third-party advertisers or data brokers.
            </Body>
          </View>

          {/* General Data Usage */}
          <View style={styles.section}>
            <SectionHeading>General Data Usage</SectionHeading>
            <Body>
              PerfectSkinDiary uses anonymous authentication — no email address or personal account
              information is required or collected on sign-up. Your data is associated with an
              anonymous session ID generated at first launch. All skin tracks, entries, and routine
              data are tied exclusively to this anonymous session.
            </Body>
          </View>

          {/* Location Data */}
          <View style={styles.section}>
            <SectionHeading>Location Data</SectionHeading>
            <Body>
              When you view the UV index on the home screen, the app requests your approximate device
              location. This is used solely to fetch local weather and UV data from Open-Meteo, an
              open-source weather service. Your location is sent directly to Open-Meteo and is not
              stored by PerfectSkinDiary beyond the current session. No account is created with
              Open-Meteo and no location data is retained on our servers.
            </Body>
          </View>

          {/* Your Rights */}
          <View style={styles.section}>
            <SectionHeading>Your Rights</SectionHeading>
            <Body>
              You maintain full control over your data. You can delete individual diary entries
              (including associated photos and analysis scores) at any time from within the app. You
              can also permanently delete your entire account and all associated data through
              Settings → Delete Account. Both actions are irreversible.
            </Body>
          </View>

          {/* Contact */}
          <View style={[styles.section, styles.contactSection]}>
            <SectionHeading>Contact Us</SectionHeading>
            <Text style={styles.body}>
              If you have questions about this Privacy Policy or our data practices, please contact
              us at{' '}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
              >
                {CONTACT_EMAIL}
              </Text>
              .
            </Text>
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

  introSection: { gap: 8 },
  lastUpdated: { fontSize: 13, color: C.onSurfaceVariant },

  sectionHeading: { fontSize: 18, fontWeight: '600', color: C.onSurface, marginBottom: 8 },
  subHeading: { fontSize: 14, fontWeight: '600', color: C.onSurface, marginTop: 12 },
  body: { fontSize: 15, color: C.onSurfaceVariant, lineHeight: 24 },

  // Biometric highlight card
  biometricCard: {
    backgroundColor: C.surfaceVariant, borderRadius: Radius.md,
    borderWidth: 1, borderColor: C.outline, padding: 20, gap: 8,
  },
  biometricHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  biometricTitle: { fontSize: 17, fontWeight: '600', color: C.primary, flex: 1 },

  section: { gap: 8 },

  // Contact
  contactSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.outline, paddingTop: 16,
  },
  link: { color: C.primary, textDecorationLine: 'underline' },

  footer: { fontSize: 12, color: C.onSurfaceVariant, textAlign: 'center', marginTop: 4 },
});
