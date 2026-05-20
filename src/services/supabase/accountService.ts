import { supabase } from './supabase';

async function deleteStorageFolder(prefix: string): Promise<void> {
  const { data: items } = await supabase.storage.from('photos').list(prefix, { limit: 1000 });
  if (!items?.length) return;

  const files: string[] = [];
  const folders: string[] = [];
  for (const item of items) {
    if (item.id !== null) files.push(`${prefix}/${item.name}`);
    else folders.push(item.name);
  }
  if (files.length) await supabase.storage.from('photos').remove(files).catch(() => {});
  for (const name of folders) await deleteStorageFolder(`${prefix}/${name}`);
}

export async function deleteUserAccount(): Promise<void> {
  // TODO: implement real deletion when ready
  // Simulates the async work so the loading UI behaves correctly.
  await new Promise(resolve => setTimeout(resolve, 1500));
}
