import { supabase } from './supabase';

export async function uploadPhoto(
  localUri: string,
  userId: string,
  issueId: string,
): Promise<string> {
  const path = `${userId}/${issueId}/selfie.jpg`;
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();
  const { error } = await supabase.storage
    .from('photos')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`uploadPhoto failed: ${error.message}`);
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
}

export async function uploadEntryPhoto(
  localUri: string,
  userId: string,
  issueId: string,
  date: string,
): Promise<string> {
  const path = `${userId}/${issueId}/${date}/${date}.jpg`;
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();
  const { error } = await supabase.storage
    .from('photos')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`uploadEntryPhoto failed: ${error.message}`);
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
}

export async function uploadGoalImage(
  remoteUrl: string,
  userId: string,
  issueId: string,
): Promise<string> {
  const path = `${userId}/${issueId}/goal.jpg`;
  const response = await fetch(remoteUrl);
  if (!response.ok) throw new Error(`Failed to fetch goal image: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const { error } = await supabase.storage
    .from('photos')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`uploadGoalImage failed: ${error.message}`);
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
}
