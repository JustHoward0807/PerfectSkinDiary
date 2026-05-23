export interface PhotoFullscreenProps {
  visible: boolean;
  photoUri: string | null;
  score: number;
  analysisScores?: unknown;
  onClose: () => void;
}
