import { supabase } from '../services/supabase/supabase';

function getGoogleModule() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
}

let _configured = false;
function ensureConfigured() {
  if (_configured || !process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) return;
  const { GoogleSignin } = getGoogleModule();
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: ['email', 'profile'],
  });
  _configured = true;
}

export async function signInWithGoogle(): Promise<'success' | 'cancelled'> {
  const { GoogleSignin, isErrorWithCode, statusCodes } = getGoogleModule();
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    const idToken = response.data?.idToken;
    if (!idToken) throw new Error('Google did not return an ID token.');

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.is_anonymous) {
      // Link Google identity to the anonymous account — preserves UID and all data
      // SDK types don't yet reflect the native token overload, so cast to any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.auth.linkIdentity as any)({ provider: 'google', token: idToken });
      if (error) throw error;
    } else {
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (error) throw error;
    }

    return 'success';
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      return 'cancelled';
    }
    throw err;
  }
}

export async function signInWithApple(identityToken: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.is_anonymous) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.auth.linkIdentity as any)({ provider: 'apple', token: identityToken });
    if (error) throw error;
  } else {
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken });
    if (error) throw error;
  }
}

export const isGoogleConfigured = (): boolean =>
  !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
