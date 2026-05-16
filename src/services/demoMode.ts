import { Image } from 'react-native';
import { trackResultStore, type PrefetchedIssue, type PrefetchedEntry } from './trackResultStore';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const demoAnalysis = require('../../demo/skinanalysisResult.json');

export const DEMO_ISSUE_ID = 'demo';

export function isDemoMode(trackName: string, selectedConcerns: Set<string>): boolean {
  return (
    trackName.toLowerCase().trim() === 'demo' &&
    selectedConcerns.has('acne') &&
    selectedConcerns.has('pores')
  );
}

function buildDemoEntries(photoUri: string): PrefetchedEntry[] {
  const today = new Date();
  // 5 entries: 4 days ago → today (oldest first, matching TrackDetail timeline order)
  return [4, 3, 2, 1, 0].map(daysAgo => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return {
      id: `demo-${daysAgo}`,
      entry_date: date.toISOString().split('T')[0],
      photo_url: photoUri,
      analysis_scores: demoAnalysis,
      delta_scores: null,
    };
  });
}

export function activateDemoMode(trackName: string): void {
  const goalUri = Image.resolveAssetSource(require('../../demo/goal.png')).uri;
  const originalUri = Image.resolveAssetSource(require('../../demo/original.png')).uri;

  const demoIssue: PrefetchedIssue = {
    id: DEMO_ISSUE_ID,
    title: trackName || 'Demo Track',
    goal_image_url: goalUri,
    target_concerns: ['acne', 'pores'],
  };
  const demoEntries = buildDemoEntries(originalUri);

  trackResultStore.set(demoAnalysis, { url: goalUri }, trackName, originalUri);
  trackResultStore.setDemo(demoIssue, demoEntries);
}
