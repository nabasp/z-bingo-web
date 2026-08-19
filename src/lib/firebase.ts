import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from 'firebase/auth';
import { firebaseConfig } from '@/config/env';

/**
 * Firebase initialization — the single Firebase seam on the web client.
 *
 * Same project as the mobile app, so the same accounts sign in on both. The
 * backend never issues its own session: the client authenticates with Firebase
 * directly and sends the resulting ID token, which the Node server verifies
 * with the Admin SDK (`bingo-node/src/lib/firebase.ts`).
 *
 * `browserLocalPersistence` is the web equivalent of the native SDK persisting
 * the session across restarts — without it a page refresh signs the player out.
 */

let auth: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (auth) return auth;

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);

  // Fire-and-forget: the default (also local) already applies, so a failure
  // here — private mode with storage blocked, say — must not break sign-in.
  void setPersistence(auth, browserLocalPersistence).catch(() => undefined);

  return auth;
}
