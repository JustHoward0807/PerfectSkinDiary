import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { unzipSync } from 'fflate';

const YOUCAM_BASE = 'https://yce-api-01.makeupar.com';
const API_KEY = process.env.EXPO_PUBLIC_YOUCAM_API_KEY!;

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
  label: string,
  apiPath: string,
  fileName: string,
  fileSize: number,
  contentType: string,
): Promise<{ fileId: string; presignedUrl: string }> {
  const res = await fetch(`${YOUCAM_BASE}${apiPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: [{ content_type: contentType, file_name: fileName, file_size: fileSize }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[${label}] file API error ${res.status}: ${body}`);
  }
  const json = await res.json();
  const file = json.data.files[0];
  const request = file.requests[0];
  return { fileId: file.file_id, presignedUrl: request.url };
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
async function createTask(label: string, apiPath: string, body: object): Promise<string> {
  const res = await fetch(`${YOUCAM_BASE}${apiPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${label}] task creation error ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.data.task_id as string;
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
async function pollTask(label: string, apiPath: string, taskId: string, maxAttempts = 40): Promise<unknown> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`${YOUCAM_BASE}${apiPath}/${taskId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`[${label}] poll error ${res.status}`);
    const json = await res.json();
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

// ── Public: download the simulation ZIP and return a base64 data URI for the image ──
// The simulation result contains a `url` field pointing to a .zip on S3.
// The ZIP contains the generated goal image (first image file inside the archive).
export async function extractGoalImageFromZip(zipUrl: string): Promise<string> {
  const response = await fetch(zipUrl);
  if (!response.ok) throw new Error(`ZIP download failed: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const files = unzipSync(new Uint8Array(arrayBuffer));

  // Find the first image entry in the ZIP
  const imageKey = Object.keys(files).find(k =>
    /\.(jpg|jpeg|png)$/i.test(k)
  );
  if (!imageKey) throw new Error('No image found inside simulation ZIP');

  // Convert Uint8Array → base64 data URI
  const bytes = files[imageKey];
  const ext = imageKey.split('.').pop()!.toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const base64 = btoa(String.fromCharCode(...bytes));
  return `data:${mime};base64,${base64}`;
}
