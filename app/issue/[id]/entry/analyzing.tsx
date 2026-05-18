import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Alert, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, IOSColors } from '../../../../src/theme';
import { runSkinAnalysis } from '../../../../src/services/youcam/youcamApi';
import { supabase } from '../../../../src/services/supabase/supabase';
import { uploadEntryPhoto } from '../../../../src/services/supabase/storage';
import { createEntry } from '../../../../src/services/supabase/issueService';

const STEPS = [
  { label: 'Uploading your photo',  sub: 'Sending your selfie securely...' },
  { label: 'Analysing your skin',   sub: 'Checking 12 skin metrics with AI...' },
  { label: 'Saving your entry',     sub: 'Almost ready!' },
] as const;

const PROGRESS_AT_STEP = [0.05, 0.50, 0.88];

const surface     = Platform.OS === 'ios' ? IOSColors.background : Colors.surface;
const textPrimary = Platform.OS === 'ios' ? IOSColors.label      : Colors.onSurface;
const textSub     = Platform.OS === 'ios' ? IOSColors.secondaryLabel : Colors.onSurfaceVariant;
const fillColor   = Colors.primary;
const trackColor  = 'rgba(0,0,0,0.10)';

export default function EntryAnalyzingScreen() {
  const { id: issueId, photoUri } = useLocalSearchParams<{ id: string; photoUri: string }>();
  const [stepIndex, setStepIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const animateTo = (toValue: number, duration = 500) => {
    Animated.timing(progressAnim, { toValue, duration, useNativeDriver: false }).start();
  };

  useEffect(() => {
    const run = async () => {
      try {
        setStepIndex(0);
        animateTo(PROGRESS_AT_STEP[0]);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const analysisPromise = runSkinAnalysis(photoUri!, user.id, issueId!, today);

        await new Promise(r => setTimeout(r, 3000));
        setStepIndex(1);
        animateTo(PROGRESS_AT_STEP[1]);

        const analysisResult = await analysisPromise;

        setStepIndex(2);
        animateTo(PROGRESS_AT_STEP[2]);

        const photoUrl = await uploadEntryPhoto(photoUri!, user.id, issueId!, today);
        const entryId = await createEntry({
          issueId: issueId!,
          userId: user.id,
          photoUrl,
          analysisScores: analysisResult,
          entryDate: today,
        });

        animateTo(1.0, 300);
        await new Promise(r => setTimeout(r, 350));

        router.replace(`/issue/${issueId}/entry/${entryId}`);
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
