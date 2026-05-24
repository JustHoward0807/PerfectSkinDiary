import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors as C, Radius } from '../../theme';
import { supabase } from '../../services/supabase/supabase';
import { fetchUserIssues, type IssueListItem } from '../../services/supabase/issueService';

const _cache = new Map<string, IssueListItem[]>();

function renderRoutinePreview(products: { name: string; routine: 'am' | 'pm' }[]) {
  const am = products.filter(p => p.routine === 'am');
  const pm = products.filter(p => p.routine === 'pm');
  if (!am.length && !pm.length) {
    return <Text style={routineStyles.noRoutine}>No routine set</Text>;
  }
  return (
    <View style={routineStyles.preview}>
      {am.length > 0 && (
        <View style={routineStyles.group}>
          <Text style={routineStyles.label}>AM</Text>
          {am.map((p, i) => (
            <Text key={i} style={routineStyles.product} numberOfLines={1}>{p.name}</Text>
          ))}
        </View>
      )}
      {pm.length > 0 && (
        <View style={routineStyles.group}>
          <Text style={routineStyles.label}>PM</Text>
          {pm.map((p, i) => (
            <Text key={i} style={routineStyles.product} numberOfLines={1}>{p.name}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const routineStyles = StyleSheet.create({
  noRoutine: { fontSize: 13, color: C.onSurfaceVariant, fontStyle: 'italic' },
  preview:   { gap: 6 },
  group:     { gap: 1 },
  label:     { fontSize: 11, fontWeight: '700', color: C.onSurface, letterSpacing: 0.4 },
  product:   { fontSize: 13, color: C.onSurfaceVariant, lineHeight: 18 },
});

function formatCreatedDate(isoDate: string | null): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getLastEntryText(entries: { entry_date: string }[]): string {
  if (entries.length === 0) return 'No entries yet';
  const latest = entries.reduce((a, b) => a.entry_date > b.entry_date ? a : b).entry_date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - parseLocalDate(latest).getTime()) / 86_400_000);
  if (diff === 0) return 'Last entry: Today';
  if (diff === 1) return 'Last entry: Yesterday';
  if (diff < 7) return `Last entry: ${diff} days ago`;
  return `Last entry: ${parseLocalDate(latest).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<IssueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isFirstMount = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        if (_cache.has(user.id)) {
          setTracks(_cache.get(user.id)!);
          setLoading(false);
          return;
        }
        const data = await fetchUserIssues(user.id);
        _cache.set(user.id, data);
        setTracks(data);
      } catch (e) {
        console.error('[HomeScreen] fetchUserIssues failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Re-fetch whenever the screen comes back into focus (e.g. after deleting a track)
  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) { isFirstMount.current = false; return; }
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          _cache.delete(user.id);
          const data = await fetchUserIssues(user.id);
          _cache.set(user.id, data);
          setTracks(data);
        } catch (e) {
          console.error('[HomeScreen] refetch failed:', e);
        }
      })();
    }, [])
  );

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

      {loading ? (
        <ActivityIndicator color={C.primary} size="large" style={styles.loader} />
      ) : (
        <View style={styles.trackList}>
          {tracks.length === 0 && (
            <Text style={styles.emptyText}>No tracks yet — start your first one below.</Text>
          )}
          {tracks.map(track => (
            <Pressable
              key={track.id}
              onPress={() => router.push(`/issue/${track.id}`)}
              style={({ pressed }) => pressed ? { opacity: 0.75 } : undefined}
            >
              <View style={styles.folder}>
                {/* Folder tab */}
                <View style={styles.folderTab} />
                {/* Folder body */}
                <View style={styles.folderBody}>
                  <View style={styles.crease} />
                  <View style={styles.folderContent}>
                    <View style={styles.topRow}>
                      <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.trackDate}>{formatCreatedDate(track.created_at)}</Text>
                    </View>
                    {renderRoutinePreview(track.products ?? [])}
                    <View style={styles.bottomRow}>
                      <Text style={styles.lastEntry}>{getLastEntryText(track.entries)}</Text>
                      <Ionicons name="chevron-forward" size={16} color={C.primary} />
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}

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
  loader: { marginVertical: 32 },
  emptyText: { fontSize: 14, color: C.onSurfaceVariant, textAlign: 'center', marginVertical: 8 },

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
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.outlineSubtle, alignItems: 'center', justifyContent: 'center',
  },
  uvTitle: { fontSize: 16, fontWeight: '600', color: C.onSurface },
  uvSub: { fontSize: 13, color: C.onSurfaceVariant, marginTop: 2 },
  sectionTitle: { fontSize: 22, fontWeight: '600', color: C.onSurface },
  trackList: { gap: 16 },

  // Folder card
  folder: {},
  folderTab: {
    width: 100,
    height: 22,
    backgroundColor: C.surfaceVariant,
    borderTopLeftRadius: Radius.sm,
    borderTopRightRadius: Radius.sm,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.outline,
  },
  folderBody: {
    backgroundColor: C.surfaceVariant,
    borderRadius: Radius.md,
    borderTopLeftRadius: 0,
    borderWidth: 1,
    borderColor: C.outline,
    overflow: 'hidden',
  },
  crease: {
    height: 1,
    backgroundColor: C.outline,
    opacity: 0.4,
  },
  folderContent: {
    padding: 16,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  trackTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: C.onSurface,
    lineHeight: 22,
  },
  trackDate: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    flexShrink: 0,
    lineHeight: 22,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  lastEntry: {
    fontSize: 14,
    fontWeight: '500',
    color: C.onSurfaceVariant,
  },

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
