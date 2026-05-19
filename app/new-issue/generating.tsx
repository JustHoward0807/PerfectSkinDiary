import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Alert, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, IOSColors } from '../../src/theme';
import { runSkinAnalysis, runSkinSimulation } from '../../src/services/youcam/youcamApi';
import { trackResultStore } from '../../src/services/trackResultStore';
import { supabase } from '../../src/services/supabase/supabase';
import { uploadPhoto, uploadGoalImage } from '../../src/services/supabase/storage';
import { createIssue, createDayOneEntry, fetchIssue, fetchEntries } from '../../src/services/supabase/issueService';
import type { Json } from '../../src/types/database.types';

const STEPS = [
  { label: 'Uploading your photo',      sub: 'Sending your selfie securely...' },
  { label: 'Analysing your skin',       sub: 'Checking 12 skin metrics with AI...' },
  { label: 'Generating goal image',     sub: 'Creating your personalised target...' },
  { label: 'Generating insights',       sub: 'Interpreting your skin scores...' },
  { label: 'Preparing your results',    sub: 'Almost ready!' },
] as const;

const PROGRESS_AT_STEP = [0.05, 0.30, 0.55, 0.75, 0.92];

const surface     = Platform.OS === 'ios' ? IOSColors.background : Colors.surface;
const textPrimary = Platform.OS === 'ios' ? IOSColors.label      : Colors.onSurface;
const textSub     = Platform.OS === 'ios' ? IOSColors.secondaryLabel : Colors.onSurfaceVariant;
const fillColor   = Colors.primary;
const trackColor  = 'rgba(0,0,0,0.10)';

export default function GeneratingScreen() {
  const { photoUri, concerns: concernsParam, trackName } = useLocalSearchParams<{
    photoUri: string;
    concerns: string;
    trackName: string;
  }>();

  const [stepIndex, setStepIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const animateTo = (toValue: number, duration = 500) => {
    Animated.timing(progressAnim, { toValue, duration, useNativeDriver: false }).start();
  };

  useEffect(() => {
    const concerns: string[] = concernsParam ? JSON.parse(concernsParam) : [];

    const run = async () => {
      try {
        setStepIndex(0);
        animateTo(PROGRESS_AT_STEP[0]);

        // Fetch user and compute date upfront — needed for mask upload paths
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        // Create the issue early to get a real UUID before analysis starts
        const issueId = await createIssue({
          userId: user.id,
          title: trackName ?? '',
          targetConcerns: concerns,
          goalImageUrl: '',       // filled in after upload
          baselineScores: null,   // filled in after analysis
        });

        // Run both in parallel (analysis needs issueId for mask upload paths)
        const analysisPromise  = runSkinAnalysis(photoUri!, user.id, issueId, today);
        const simulationPromise = runSkinSimulation(photoUri!, concerns);

        // Advance to "Analysing" after upload window (~3 s)
        await new Promise(r => setTimeout(r, 3000));
        setStepIndex(1);
        animateTo(PROGRESS_AT_STEP[1]);

        // Advance to "Generating goal image" after another 4 s
        await new Promise(r => setTimeout(r, 4000));
        setStepIndex(2);
        animateTo(PROGRESS_AT_STEP[2]);

        const [analysisResult, simulationResult] = await Promise.all([
          analysisPromise,
          simulationPromise,
        ]);

        // Step 3 — Claude insights (no products on Day 1)
        setStepIndex(3);
        animateTo(PROGRESS_AT_STEP[3]);

        let llmSummary: string | null = null;
        try {
          const { data } = await supabase.functions.invoke('interpret', {
            body: { scores: analysisResult, products: [] },
          });
          llmSummary = (data as { summary?: string } | null)?.summary ?? null;
        } catch { /* non-fatal — proceed without summary */ }

        setStepIndex(4);
        animateTo(PROGRESS_AT_STEP[4]);

        // ── Persist to Supabase ──────────────────────────────────────────────
        const simUrl = (simulationResult as Record<string, unknown>)?.url as string | undefined;
        if (!simUrl) throw new Error('No simulation URL returned');

        // 1. Upload both images in parallel
        const [photoUrl, goalImageUrl] = await Promise.all([
          uploadPhoto(photoUri!, user.id, issueId),
          uploadGoalImage(simUrl, user.id, issueId),
        ]);

        // 2. Patch goal_image_url and baseline_scores now that we have them
        await supabase.from('issues').update({ goal_image_url: goalImageUrl, baseline_scores: analysisResult as Json }).eq('id', issueId);

        // 3. Insert the Day 1 entry
        await createDayOneEntry({
          issueId,
          userId: user.id,
          photoUrl,
          analysisScores: analysisResult,
          entryDate: today,
          llmSummary,
        });

        // 4. Prefetch issue + entries so TrackDetail renders instantly (no spinner)
        const [prefetchedIssue, prefetchedEntries] = await Promise.all([
          fetchIssue(issueId),
          fetchEntries(issueId),
        ]);

        trackResultStore.set(analysisResult, simulationResult, trackName ?? '', photoUri ?? '');
        trackResultStore.setPrefetch(issueId, prefetchedIssue, prefetchedEntries);
        // ────────────────────────────────────────────────────────────────────

        animateTo(1.0, 300);
        await new Promise(r => setTimeout(r, 350));

        router.replace(`/issue/${issueId}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        Alert.alert('Analysis failed', message, [
          { text: 'Go back', onPress: () => router.back() },
        ]);
      }
    };

    run();
  }, []);

  const step = STEPS[stepIndex];

  return (
    <View style={[styles.root, { backgroundColor: surface }]}>
      <View style={styles.card}>
        <Text style={[styles.title, { color: textPrimary }]}>{step.label}</Text>
        <Text style={[styles.sub, { color: textSub }]}>{step.sub}</Text>

        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: fillColor,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <Text style={[styles.counter, { color: textSub }]}>
          Step {stepIndex + 1} of {STEPS.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card:    { width: '78%', alignItems: 'center', gap: 14 },
  title:   { fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },
  sub:     { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  track:   { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  fill:    { height: '100%', borderRadius: 4 },
  counter: { fontSize: 12 },
});
