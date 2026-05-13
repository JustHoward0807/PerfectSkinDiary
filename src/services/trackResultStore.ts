// In-memory store for passing large API results between the generating screen and the
// track detail screen without serialising them into URL params.
interface Stored {
  analysisResult: unknown;
  simulationResult: unknown;
  trackName: string;
  photoUri: string;
}

const _store: Stored = {
  analysisResult: null,
  simulationResult: null,
  trackName: '',
  photoUri: '',
};

export const trackResultStore = {
  set(analysis: unknown, simulation: unknown, trackName: string, photoUri: string) {
    _store.analysisResult = analysis;
    _store.simulationResult = simulation;
    _store.trackName = trackName;
    _store.photoUri = photoUri;
  },
  get(): Stored {
    return { ..._store };
  },
  clear() {
    _store.analysisResult = null;
    _store.simulationResult = null;
    _store.trackName = '';
    _store.photoUri = '';
  },
};
