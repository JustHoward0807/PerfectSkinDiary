// In-memory store for passing large API results between the generating screen and the
// track detail screen without serialising them into URL params.

export interface PrefetchedIssue {
  id: string;
  title: string;
  goal_image_url: string | null;
  target_concerns: unknown;
}

export interface PrefetchedEntry {
  id: string;
  entry_date: string;
  photo_url: string;
  analysis_scores: unknown;
  delta_scores: unknown;
}

interface Stored {
  analysisResult: unknown;
  simulationResult: unknown;
  trackName: string;
  photoUri: string;
  // One-shot prefetch from the generating screen — consumed once then cleared
  prefetch: {
    issueId: string;
    issue: PrefetchedIssue;
    entries: PrefetchedEntry[];
  } | null;
  // Persistent demo state — survives back-navigation within the demo session
  demoState: {
    issue: PrefetchedIssue;
    entries: PrefetchedEntry[];
  } | null;
}

const _store: Stored = {
  analysisResult: null,
  simulationResult: null,
  trackName: '',
  photoUri: '',
  prefetch: null,
  demoState: null,
};

export const trackResultStore = {
  set(analysis: unknown, simulation: unknown, trackName: string, photoUri: string) {
    _store.analysisResult = analysis;
    _store.simulationResult = simulation;
    _store.trackName = trackName;
    _store.photoUri = photoUri;
  },

  // ── One-shot prefetch (post-creation fast path) ──────────────────────────
  setPrefetch(issueId: string, issue: PrefetchedIssue, entries: PrefetchedEntry[]) {
    _store.prefetch = { issueId, issue, entries };
  },
  consumePrefetch(issueId: string): { issue: PrefetchedIssue; entries: PrefetchedEntry[] } | null {
    if (_store.prefetch?.issueId !== issueId) return null;
    const result = { issue: _store.prefetch.issue, entries: _store.prefetch.entries };
    _store.prefetch = null;
    return result;
  },

  // ── Persistent demo state ────────────────────────────────────────────────
  setDemo(issue: PrefetchedIssue, entries: PrefetchedEntry[]) {
    _store.demoState = { issue, entries };
  },
  getDemo(): { issue: PrefetchedIssue; entries: PrefetchedEntry[] } | null {
    return _store.demoState;
  },
  clearDemo() {
    _store.demoState = null;
  },

  get(): Omit<Stored, 'prefetch' | 'demoState'> {
    return {
      analysisResult: _store.analysisResult,
      simulationResult: _store.simulationResult,
      trackName: _store.trackName,
      photoUri: _store.photoUri,
    };
  },
  clear() {
    _store.analysisResult = null;
    _store.simulationResult = null;
    _store.trackName = '';
    _store.photoUri = '';
    _store.prefetch = null;
    _store.demoState = null;
  },
};
