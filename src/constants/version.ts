import Constants from 'expo-constants';

export const APP_VERSION = `v${Constants.expoConfig?.version ?? '0.0.0'}`;
export const COPYRIGHT_YEAR = new Date().getFullYear();
