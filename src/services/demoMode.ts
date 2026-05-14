import { Image } from 'react-native';
import { trackResultStore } from './trackResultStore';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const demoAnalysis = require('../../demo/skinanalysisResult.json');

export function isDemoMode(trackName: string, selectedConcerns: Set<string>): boolean {
  return (
    trackName.toLowerCase().trim() === 'demo' &&
    selectedConcerns.has('acne') &&
    selectedConcerns.has('pores')
  );
}

export function activateDemoMode(trackName: string): void {
  const goalUri = Image.resolveAssetSource(require('../../demo/goal.png')).uri;
  const originalUri = Image.resolveAssetSource(require('../../demo/original.png')).uri;
  trackResultStore.set(demoAnalysis, { url: goalUri }, trackName, originalUri);
}
