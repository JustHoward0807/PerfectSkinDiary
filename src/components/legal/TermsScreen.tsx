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

function Body({ children }: { children: string }) {
  return <Text style={styles.body}>{children}</Text>;
}

function BulletItem({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export default function TermsScreen() {
  return (
    <View style={styles.root}>
      <Header title="Terms of Service" />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Page header */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Terms of Service</Text>
            <Text style={styles.pageSubtitle}>Last Updated: {LAST_UPDATED}</Text>
          </View>

          <Body>
            Welcome to PerfectSkinDiary. Please read these Terms of Service ("Terms") carefully before
            using our application. By accessing or using PerfectSkinDiary, you agree to be bound by
            these Terms and our Privacy Policy.
          </Body>

          {/* 1 */}
          <SectionHeading>1. Acceptance of Terms</SectionHeading>
          <Body>
            By using PerfectSkinDiary, you confirm that you are of legal age to form a binding contract
            and that you accept these Terms in full. If you do not agree with any part of these Terms,
            you must not use our service.
          </Body>

          {/* 2 */}
          <SectionHeading>2. Use of Service</SectionHeading>
          <Body>
            PerfectSkinDiary is designed to help you track your personal skincare routine and progress.
            You agree to use the service only for lawful purposes and in a way that does not infringe
            the rights of, restrict, or inhibit anyone else's use and enjoyment of the service.
          </Body>
          <View style={styles.bulletList}>
            <BulletItem>You are responsible for all activity associated with your anonymous session.</BulletItem>
            <BulletItem>You must keep your device secure to protect your data.</BulletItem>
            <BulletItem>You must not use the app to distribute malicious content or spam.</BulletItem>
          </View>

          {/* 3 — Medical disclaimer */}
          <SectionHeading>3. Medical Disclaimer</SectionHeading>
          <View style={styles.disclaimerCard}>
            <View style={styles.disclaimerHeader}>
              <Ionicons name="warning-outline" size={20} color={C.primary} />
              <Text style={styles.disclaimerTitle}>Not Medical Advice</Text>
            </View>
            <Text style={styles.disclaimerBody}>
              PerfectSkinDiary is a tracking tool, not a diagnostic instrument. The information provided
              within the app is for general informational purposes only and is not a substitute for
              professional medical advice, diagnosis, or treatment. Always seek the advice of your
              physician or other qualified health provider with any questions you may have regarding a
              medical condition.
            </Text>
          </View>

          {/* 4 */}
          <SectionHeading>4. User Content</SectionHeading>
          <Body>
            You retain all rights to the data, images, and text you upload to PerfectSkinDiary ("User
            Content"). By uploading User Content, you grant us a non-exclusive, worldwide, royalty-free
            licence to use, store, and process this content solely for the purpose of providing the
            service to you.
          </Body>

          {/* 5 */}
          <SectionHeading>5. Termination</SectionHeading>
          <Body>
            We may terminate or suspend your access to the service immediately, without prior notice or
            liability, for any reason whatsoever, including without limitation if you breach these Terms.
            Upon termination, your right to use the service will immediately cease.
          </Body>

          {/* 6 */}
          <SectionHeading>6. Changes to Terms</SectionHeading>
          <Body>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time.
            If a revision is material, we will try to provide at least 30 days' notice prior to any new
            Terms taking effect.
          </Body>

          {/* Contact */}
          <View style={styles.contactSection}>
            <Text style={styles.contactText}>
              If you have any questions about these Terms, please contact us at{' '}
            </Text>
            <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
              <Text style={styles.contactLink}>{CONTACT_EMAIL}</Text>
            </Pressable>
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
  scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32, gap: 16 },

  pageHeader: { gap: 4 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: C.primary, lineHeight: 36 },
  pageSubtitle: { fontSize: 13, color: C.onSurfaceVariant },

  sectionHeading: { fontSize: 18, fontWeight: '600', color: C.secondary, marginTop: 8 },
  body: { fontSize: 15, color: C.onSurface, lineHeight: 24 },

  bulletList: { gap: 8, paddingLeft: 4 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontSize: 15, color: C.onSurfaceVariant, lineHeight: 24 },
  bulletText: { flex: 1, fontSize: 15, color: C.onSurfaceVariant, lineHeight: 24 },

  // Medical disclaimer card
  disclaimerCard: {
    backgroundColor: C.surfaceVariant, borderRadius: Radius.md,
    borderWidth: 1, borderColor: C.outline, padding: 16, gap: 8,
  },
  disclaimerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disclaimerTitle: { fontSize: 15, fontWeight: '600', color: C.primary },
  disclaimerBody: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 22 },

  // Contact
  contactSection: {
    paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.outline, gap: 2,
  },
  contactText: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 22 },
  contactLink: { fontSize: 14, color: C.primary, textDecorationLine: 'underline' },

  footer: { fontSize: 12, color: C.onSurfaceVariant, textAlign: 'center', marginTop: 8 },
});
