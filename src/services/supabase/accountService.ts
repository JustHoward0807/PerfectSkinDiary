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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Delete all storage files (SQL functions can't touch Storage buckets)
  await deleteStorageFolder(user.id).catch(() => {});

  // 2. Delete DB records + auth user via SECURITY DEFINER function
  const { error } = await supabase.rpc('delete_user_account');
  if (error) throw new Error(error.message);

  // 3. Clear the now-invalid local session
  await supabase.auth.signOut();

  // 4. Create a fresh anonymous account — caller can navigate home after this
  await supabase.auth.signInAnonymously();
}
