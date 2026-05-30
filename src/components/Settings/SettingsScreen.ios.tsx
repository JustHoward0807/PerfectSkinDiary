import { useState, type ReactNode } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IOSColors, Radius } from '../../theme';
import { APP_VERSION, COPYRIGHT_YEAR } from '../../constants/version';
import { deleteUserAccount } from '../../services/supabase/accountService';
import { useWallet } from '../../hooks/useWallet';
import { useAuth } from '../../hooks/useAuth';
import { EmailGateSheet } from '../ui';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const BG   = '#F2F2F7';
const CARD = '#FFFFFF';

// ── Sub-components ────────────────────────────────────────────────────────────

function NavItem({ icon, label, onPress }: { icon: IoniconName; label: ReactNode; onPress: () => void }) {
  return (
    <Pressable style={styles.navItem} onPress={onPress}>
      <View style={styles.navIconCircle}>
        <Ionicons name={icon} size={19} color={IOSColors.secondaryLabel} />
      </View>
      {typeof label === 'string'
        ? <Text style={styles.navLabel}>{label}</Text>
        : <View style={styles.navLabelRow}>{label}</View>
      }
      <Ionicons name="chevron-forward" size={16} color={IOSColors.secondaryLabel} />
    </Pressable>
  );
}

function DeleteConfirmModal({
  visible, deleting, onCancel, onConfirm,
}: {
  visible: boolean; deleting: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={34} color={IOSColors.label} />
          </View>
          <Text style={styles.modalTitle}>Are you sure you want to delete your account?</Text>
          <Text style={styles.modalBody}>
            This action is irreversible. It will permanently delete all of your skin photos, goal
            images, and clinical analysis results from our servers. You will be signed out immediately.
          </Text>
          {deleting ? (
            <ActivityIndicator size="large" color={IOSColors.label} style={{ marginVertical: 12 }} />
          ) : (
            <>
              <Pressable style={styles.modalDeleteBtn} onPress={onConfirm}>
                <Text style={styles.modalDeleteBtnText}>DELETE MY DATA</Text>
              </Pressable>
              <Pressable style={styles.modalCancelBtn} onPress={onCancel}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [authVisible,  setAuthVisible]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { balance, isInTrial, loading: walletLoading } = useWallet();
  const { user } = useAuth();

  const isAnonymous = user?.is_anonymous ?? true;
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Anonymous';

  const walletLabel: ReactNode = walletLoading
    ? 'My Wallet'
    : isInTrial
      ? 'My Wallet  •  Free Trial'
      : (
        <>
          <Text style={{ fontSize: 16, color: IOSColors.label }}>{`My Wallet: ${balance ?? 0} `}</Text>
          <Ionicons name="ellipse" size={11} color="#FFD700" />
        </>
      );

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await deleteUserAccount();
      router.replace('/');
    } catch {
      setDeleting(false);
      setModalVisible(false);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: top + 16, paddingBottom: bottom + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        {/* Profile — only shown when signed in */}
        {!isAnonymous && (
          <BlurView intensity={60} tint="systemChromeMaterial" style={styles.profileCard}>
            <Text style={styles.userName}>{displayName}</Text>
          </BlurView>
        )}

        {/* Navigation list */}
        <BlurView intensity={60} tint="systemChromeMaterial" style={styles.sectionCard}>
          {isAnonymous && (
            <>
              <NavItem icon="person-circle-outline" label="Sign In & Secure Account" onPress={() => setAuthVisible(true)} />
              <View style={styles.divider} />
            </>
          )}
          <NavItem icon="wallet-outline" label={walletLabel} onPress={() => router.push('/wallet')} />
          <View style={styles.divider} />
          <NavItem icon="information-circle-outline" label="About App" onPress={() => router.push('/about')} />
          <View style={styles.divider} />
          <NavItem icon="document-text-outline" label="Terms of Service" onPress={() => router.push('/terms')} />
          <View style={styles.divider} />
          <NavItem icon="shield-outline" label="Privacy Policy" onPress={() => router.push('/privacy')} />
        </BlurView>

        {/* Delete Account */}
        <Pressable style={styles.deleteBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="trash-outline" size={18} color={IOSColors.label} />
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </Pressable>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerVersion}>© {COPYRIGHT_YEAR} PerfectSkinDiary • {APP_VERSION}</Text>
          <Text style={styles.footerPoweredBy}>POWERED BY</Text>
          <Text style={styles.footerCredits}>PERFECT CORP YOUCAM • OPEN-METEO • ANTHROPIC</Text>
        </View>
      </ScrollView>

      <DeleteConfirmModal
        visible={modalVisible}
        deleting={deleting}
        onCancel={() => { if (!deleting) setModalVisible(false); }}
        onConfirm={handleDeleteConfirm}
      />

      <EmailGateSheet
        visible={authVisible}
        onLinked={() => setAuthVisible(false)}
        onDismiss={() => setAuthVisible(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, gap: 16 },
  title:   { fontSize: 34, fontWeight: '700', letterSpacing: 0.4, color: IOSColors.label },

  // Profile card
  profileCard: {
    borderRadius: Radius.md, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: IOSColors.separator,
    paddingVertical: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  userName: { fontSize: 17, fontWeight: '600', color: IOSColors.label },

  // Navigation section
  sectionCard: {
    borderRadius: Radius.md, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: IOSColors.separator,
  },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  navIconCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: BG,
    borderWidth: StyleSheet.hairlineWidth, borderColor: IOSColors.separator,
    alignItems: 'center', justifyContent: 'center',
  },
  navLabel:    { flex: 1, fontSize: 16, color: IOSColors.label },
  navLabelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: IOSColors.separator, marginLeft: 64 },

  // Delete Account button
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: IOSColors.separator, borderRadius: Radius.full,
    paddingVertical: 14, paddingHorizontal: 24, backgroundColor: CARD,
  },
  deleteBtnText: { fontSize: 16, fontWeight: '500', color: IOSColors.label },

  // Footer
  footer: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  footerVersion:   { fontSize: 13, color: IOSColors.secondaryLabel },
  footerPoweredBy: { fontSize: 11, fontWeight: '600', color: IOSColors.secondaryLabel, letterSpacing: 0.5, marginTop: 8 },
  footerCredits:   { fontSize: 11, color: IOSColors.secondaryLabel, letterSpacing: 0.3, textAlign: 'center' },

  // Delete confirm modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: {
    backgroundColor: CARD, borderRadius: Radius.lg, padding: 28,
    width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24,
  },
  warningBox: {
    width: 68, height: 68, borderRadius: Radius.md,
    borderWidth: 2, borderColor: IOSColors.label,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: IOSColors.label, textAlign: 'center', marginBottom: 12, lineHeight: 28 },
  modalBody:  { fontSize: 15, color: IOSColors.secondaryLabel, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  modalDeleteBtn: {
    backgroundColor: IOSColors.label, borderRadius: Radius.full,
    paddingVertical: 15, width: '100%', alignItems: 'center', marginBottom: 12,
  },
  modalDeleteBtnText: { color: CARD, fontSize: 15, fontWeight: '700', letterSpacing: 0.8 },
  modalCancelBtn: {
    borderWidth: 1.5, borderColor: IOSColors.separator, borderRadius: Radius.full,
    paddingVertical: 15, width: '100%', alignItems: 'center',
  },
  modalCancelBtnText: { color: IOSColors.label, fontSize: 15, fontWeight: '500' },
});
