import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import { supabase } from '../supabase/supabase';
import { fetchRecentEntries, type RecentEntry } from '../supabase/issueService';
import { extractMaskUrls } from './scoreExtractor';
import { generatePdfHtml } from './pdfTemplate';

async function fetchBase64(url: string): Promise<string | null> {
  let tmpFile: File | null = null;
  try {
    const name = `psd_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    tmpFile = await File.downloadFileAsync(url, new File(Paths.cache, name));
    const b64 = await tmpFile.base64();
    await tmpFile.delete();
    const ext = url.split('?')[0].toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    return `data:image/${ext};base64,${b64}`;
  } catch {
    try { await tmpFile?.delete(); } catch { /* ignore */ }
    return null;
  }
}

async function fetchPdfInsight(entries: RecentEntry[]): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke('interpret', {
      body: {
        entries: entries.map(e => ({ date: e.entry_date, scores: e.analysis_scores })),
        products: [],
      },
    });
    if (error || !data?.bullets) return null;
    return data.bullets as string[];
  } catch {
    return null;
  }
}

/** Fetches entries, embeds images, calls Claude for trend insight, renders HTML → PDF, returns the file:// URI. */
export async function generateSkinPdf(userId: string): Promise<string> {
  const entries = await fetchRecentEntries(userId, 5);
  if (entries.length === 0) throw new Error('No entries found. Add your first skin entry to generate a report.');

  const urlSet = new Set<string>();
  for (const e of entries) {
    if (e.photo_url?.startsWith('http')) urlSet.add(e.photo_url);
    const masks = extractMaskUrls(e.analysis_scores);
    for (const url of Object.values(masks)) {
      if (url) urlSet.add(url);
    }
  }

  // Image fetching and Claude insight call run in parallel
  const [b64Map, bullets] = await Promise.all([
    Promise.all(
      [...urlSet].map(async url => {
        const data = await fetchBase64(url);
        return [url, data] as [string, string | null];
      })
    ).then(pairs => {
      const m = new Map<string, string>();
      for (const [url, data] of pairs) if (data) m.set(url, data);
      return m;
    }),
    fetchPdfInsight(entries),
  ]);

  const html = generatePdfHtml(entries, b64Map, bullets);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Opens the PDF file in the system viewer:
 * - Android: ACTION_VIEW intent → default PDF app opens directly.
 * - iOS: share sheet (UIActivityViewController) so the user can pick
 *        Books, Save to Files, AirDrop, etc.
 */
export async function sharePdfFile(uri: string): Promise<void> {
  if (Platform.OS === 'android') {
    const contentUri = await getContentUriAsync(uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/pdf',
    });
  } else {
    await Sharing.shareAsync(uri, {
      UTI: 'com.adobe.pdf',
      mimeType: 'application/pdf',
      dialogTitle: 'Share Skin Progress Report',
    });
  }
}
