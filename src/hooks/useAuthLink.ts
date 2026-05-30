import { supabase } from '../services/supabase/supabase';

// Lazy require — @react-native-google-signin/google-signin is a native module
// that crashes at import time in Expo Go. Requiring it inside functions means
// the crash is deferred to the moment the user taps "Continue with Google",
// where we can show a graceful error instead of breaking all routes.
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

async function linkOrSignIn(provider: 'google' | 'apple', token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.is_anonymous) {
    const { error } = await supabase.auth.linkIdentity({ provider, token });
    if (!error) return;
    // Identity already belongs to a permanent account → restore it
  }
  const { error } = await supabase.auth.signInWithIdToken({ provider, token });
  if (error) throw error;
}

// Returns 'cancelled' when the user dismisses the Google sheet; throws on real errors.
export async function signInWithGoogle(): Promise<'success' | 'cancelled'> {
  const { GoogleSignin, isErrorWithCode, statusCodes } = getGoogleModule();
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    const idToken = response.data?.idToken;
    if (!idToken) throw new Error('Google did not return an ID token.');
    await linkOrSignIn('google', idToken);
    return 'success';
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      return 'cancelled';
    }
    throw err;
  }
}

export async function signInWithApple(identityToken: string): Promise<void> {
  await linkOrSignIn('apple', identityToken);
}

export const isGoogleConfigured = (): boolean =>
  !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
