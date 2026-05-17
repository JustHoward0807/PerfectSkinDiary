import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { unzipSync } from 'fflate';
import { supabase } from '../supabase/supabase';

// Routes authenticated YouCam API calls through the youcam-proxy Edge Function
// so the API key stays server-side. S3 uploads go directly to S3 (no key needed).
async function youcamFetch(path: string, method: string, body?: unknown): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('youcam-proxy', {
    body: { path, method, body },
  });
  if (error) {
    let message = 'YouCam API error. Please try again.';
    try {
      const errBody = await (error as { context?: Response }).context?.json?.();
      if (typeof errBody?.error === 'string') message = errBody.error;
    } catch { /* use default */ }
    throw new Error(message);
  }
  return data;
};

const HD_ACTIONS = [
  'hd_wrinkle', 'hd_pore', 'hd_acne', 'hd_moisture', 'hd_redness',
  'hd_oiliness', 'hd_texture', 'hd_radiance', 'hd_firmness', 'hd_age_spot',
  'hd_dark_circle', 'hd_eye_bag',
];

// ── Image prep ──
// Enforce: longest side ≤ 2048px (< 2560 API cap) AND shortest side ≥ 1080px (HD minimum).
async function preparePhoto(uri: string): Promise<string> {
  const probe = await ImageManipulator.manipulate(uri).renderAsync();
  const { width: w, height: h } = probe;

  const MAX_SIDE  = 2048;
  const MIN_SHORT = 1080;
  const longSide  = Math.max(w, h);
  const shortSide = Math.min(w, h);

  let scale = 1;
  if (longSide > MAX_SIDE) {
    scale = MAX_SIDE / longSide;
  } else if (shortSide < MIN_SHORT) {
    scale = MIN_SHORT / shortSide;
  }

  const targetWidth = Math.round(w * scale);

  const resized = await ImageManipulator.manipulate(uri)
    .resize({ width: targetWidth })
    .renderAsync();
  return (await resized.saveAsync({ compress: 0.9, format: SaveFormat.JPEG })).uri;
}

// ── Step 1: register file with YouCam and receive a presigned S3 PUT URL + file_id ──
async function getPresignedUrl(
  _label: string,
  apiPath: string,
  fileName: string,
  fileSize: number,
  contentType: string,
): Promise<{ fileId: string; presignedUrl: string }> {
  const json = await youcamFetch(apiPath, 'POST', {
    files: [{ content_type: contentType, file_name: fileName, file_size: fileSize }],
  }) as { data: { files: { file_id: string; requests: { url: string }[] }[] } };
  const file = json.data.files[0];
  return { fileId: file.file_id, presignedUrl: file.requests[0].url };
}

// ── Step 2: upload binary image to the S3 presigned URL ──
async function uploadToS3(presignedUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`S3 upload failed ${res.status}: ${body}`);
  }
}

// ── Step 3: create an analysis/simulation task ──
async function createTask(_label: string, apiPath: string, body: object): Promise<string> {
  const json = await youcamFetch(apiPath, 'POST', body) as { data: { task_id: string } };
  return json.data.task_id;
}

const YOUCAM_ERROR_MESSAGES: Record<string, string> = {
  error_below_min_image_size:  'Your photo resolution is too low. Please retake your selfie in better lighting or move closer to the camera.',
  error_exceed_max_image_size: 'Your photo resolution is too high. Please retake your selfie.',
  error_invalid_params:        'Something went wrong with the request. Please try again.',
  error_src_face_too_small:    'Your face is too small in the photo. Make sure your face fills at least 60% of the frame and try again.',
  error_src_face_out_of_bound: 'Your face is partially outside the photo. Ensure your full face — forehead, cheeks, and chin — is visible and try again.',
  error_lighting_dark:         'The photo is too dark. Move to a well-lit area with even lighting on your face and retake your selfie.',
};

// ── Step 4: poll GET until task_status = 'success' ──
async function pollTask(_label: string, apiPath: string, taskId: string, maxAttempts = 40): Promise<unknown> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const json = await youcamFetch(`${apiPath}/${taskId}`, 'GET') as { data: { task_status: string; error?: string; results?: unknown; result?: unknown } };
    const { task_status, error: errorCode } = json.data;
    if (task_status === 'success') {
      return json.data.results ?? json.data.result ?? json.data;
    }
    if (task_status === 'error') {
      const friendly = errorCode ? YOUCAM_ERROR_MESSAGES[errorCode] : undefined;
      throw new Error(friendly ?? `Analysis failed (${errorCode ?? 'unknown error'}). Please try again.`);
    }
  }
  throw new Error('Analysis is taking too long. Please check your connection and try again.');
}

// ── Extract score_info.json from the analysis result ZIP ──
// The analysis poll result is { url: "https://...zip" }.
// The ZIP contains a folder with .png mask files, a 1.jpg, and score_info.json.
async function extractScoreInfoFromZip(zipUrl: string): Promise<unknown> {
  const res = await fetch(zipUrl);
  if (!res.ok) throw new Error(`[analysis] ZIP download failed: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const files = unzipSync(new Uint8Array(buffer));

  const scoreKey = Object.keys(files).find(k => k.endsWith('score_info.json'));
  if (!scoreKey) throw new Error('[analysis] score_info.json not found in ZIP');

  const text = new TextDecoder().decode(files[scoreKey]);
  console.log('[analysis] score_info.json content:', text);
  return JSON.parse(text);
}

// ── Public: run HD skin analysis ──
export async function runSkinAnalysis(photoUri: string): Promise<unknown> {
  const readyUri = await preparePhoto(photoUri);
  const localBlob = await fetch(readyUri).then(r => r.blob());
  const contentType = 'image/jpeg';

  const { fileId, presignedUrl } = await getPresignedUrl(
    'analysis',
    '/s2s/v2.0/file/skin-analysis',
    'photo.jpg',
    localBlob.size,
    contentType,
  );
  await uploadToS3(presignedUrl, localBlob);

  const taskId = await createTask('analysis', '/s2s/v2.0/task/skin-analysis', {
    src_file_id: fileId,
    dst_actions: HD_ACTIONS,
  });

  // Poll returns { url: "...zip" } — download and extract score_info.json
  const taskResult = await pollTask('analysis', '/s2s/v2.0/task/skin-analysis', taskId);
  const zipUrl = (taskResult as { url: string }).url;
  return extractScoreInfoFromZip(zipUrl);
}

const ALL_SIM_KEYS = ['acne', 'dark_circles', 'eye_bags', 'oiliness', 'pores', 'radiance', 'redness', 'spots', 'texture', 'wrinkle'];

// ── Public: run skin simulation ──
// selectedConcerns: keys from AddNewTrack. Only those get intensity 0.5.
// Empty array → all concerns at 0.5.
export async function runSkinSimulation(photoUri: string, selectedConcerns: string[]): Promise<unknown> {
  const readyUri = await preparePhoto(photoUri);
  const localBlob = await fetch(readyUri).then(r => r.blob());
  const contentType = 'image/jpeg';

  const { fileId, presignedUrl } = await getPresignedUrl(
    'simulation',
    '/s2s/v2.0/file/skin-simulation',
    'photo.jpg',
    localBlob.size,
    contentType,
  );
  await uploadToS3(presignedUrl, localBlob);

  const selectedSet = new Set(selectedConcerns);
  const hasSelection = selectedConcerns.length > 0;
  const concernBody: Record<string, number> = {};
  for (const key of ALL_SIM_KEYS) {
    if (!hasSelection || selectedSet.has(key)) concernBody[key] = 0.5;
  }

  const taskId = await createTask('simulation', '/s2s/v2.0/task/skin-simulation', {
    src_file_id: fileId,
    ...concernBody,
  });

  return pollTask('simulation', '/s2s/v2.0/task/skin-simulation', taskId);
}

// ── Public: resolve the simulation result URL to a displayable image URI ──
// The YouCam simulation API may return either:
//   • A direct image URL (JPEG/PNG) — use it as-is; React Native Image handles HTTPS URLs.
//   • A ZIP URL — extract the first image inside and return a base64 data URI.
// We distinguish the two by checking the ZIP magic bytes (PK signature: 0x50 0x4B).
export async function extractGoalImageFromZip(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Goal image fetch failed: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Not a ZIP — the API returned a direct image URL. Return it for Image to load directly.
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
    return url;
  }

  // It is a ZIP — extract the first image entry.
  const files = unzipSync(bytes);
  const imageKey = Object.keys(files).find(k => /\.(jpg|jpeg|png)$/i.test(k));
  if (!imageKey) throw new Error('No image found inside simulation ZIP');

  // Convert in 8 KB chunks to avoid spreading a large Uint8Array into String.fromCharCode,
  // which exceeds the JS engine call-stack limit for any realistically-sized image.
  const imgBytes = files[imageKey];
  const ext = imageKey.split('.').pop()!.toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < imgBytes.length; i += CHUNK) {
    binary += String.fromCharCode(...imgBytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
