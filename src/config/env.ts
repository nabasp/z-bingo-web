/**
 * Validated runtime configuration.
 *
 * Every value comes from a `VITE_`-prefixed environment variable and is inlined
 * at build time — nothing here is hardcoded, and no URL or key is duplicated
 * anywhere else in the app.
 *
 * Missing variables throw at startup with the full list, rather than surfacing
 * later as an `undefined` base URL or an opaque Firebase error. That mirrors the
 * mobile build, where `react-native-dotenv` runs with `allowUndefined: false`.
 */

interface RawEnv {
  VITE_API_BASE_URL?: string;
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
}

const REQUIRED = [
  'VITE_API_BASE_URL',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

/**
 * `storageBucket` and `messagingSenderId` are only needed by Storage and FCM,
 * neither of which this app uses — so they are accepted but not required.
 */
const raw = import.meta.env as unknown as RawEnv;

const missing = REQUIRED.filter(key => !raw[key]?.trim());
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}. ` +
      'They are supplied by the z-bingo-deployment stack; see its DEPLOYMENT.md.',
  );
}

/** Trailing slashes would produce `//auth/me` once a path is appended. */
function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Backend base URL — used for the REST calls AND the Socket.IO connection.
 * They share one port on the server, exactly as they do for the mobile app.
 */
export const API_BASE_URL = trimTrailingSlash(raw.VITE_API_BASE_URL!.trim());

/** Request timeout for backend calls (ms). Matches the mobile client. */
export const API_TIMEOUT_MS = 15000;

export const firebaseConfig = {
  apiKey: raw.VITE_FIREBASE_API_KEY!.trim(),
  authDomain: raw.VITE_FIREBASE_AUTH_DOMAIN!.trim(),
  projectId: raw.VITE_FIREBASE_PROJECT_ID!.trim(),
  storageBucket: raw.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: raw.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: raw.VITE_FIREBASE_APP_ID!.trim(),
};
