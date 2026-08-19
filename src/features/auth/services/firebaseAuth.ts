import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import type { User } from '@/types';

/**
 * Firebase Auth wrapper — the single Firebase seam on the client.
 *
 * Deliberately exports the same names and shapes as
 * `bingo/src/features/auth/services/firebaseAuth.ts`, so everything above it —
 * the auth service, the provider, the form hooks — is structurally identical on
 * both platforms. Only the mechanics differ: the native provider SDKs become
 * `signInWithPopup`, and `@react-native-firebase/auth` becomes the Web SDK.
 *
 * Firebase owns the session: it persists it across reloads and auto-refreshes
 * ID tokens, which the backend then verifies.
 *
 * Apple sign-in is intentionally absent on web. It is iOS-only in the mobile
 * app, and enabling it in a browser needs an Apple Developer Service ID and a
 * verified return URL configured in Firebase first.
 */

export type { FirebaseUser };

/** Map a Firebase user to the app's `User`. Profile lives in Firebase Auth. */
export function mapFirebaseUser(user: FirebaseUser): User {
  return {
    id: user.uid,
    fullName: user.displayName ?? '',
    email: user.email ?? '',
    avatarUrl: user.photoURL ?? undefined,
  };
}

/** Subscribe to auth-state changes. Returns an unsubscribe function. */
export function onAuthChanged(cb: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}

/** A fresh Firebase ID token for backend/socket auth. Null when signed out. */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  return user ? user.getIdToken(forceRefresh) : null;
}

export async function signInEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function signUpEmail(
  email: string,
  password: string,
  name: string,
): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password,
  );

  if (name) {
    await updateProfile(user, { displayName: name });
    /*
     * Force a fresh ID token so it carries the new `name` claim.
     *
     * This matters beyond the greeting: the backend takes a player's display
     * name straight off the verified token
     * (`bingo-node/src/modules/socket/socket.middleware.ts`), so without the
     * refresh a brand-new player joins their first room as the local part of
     * their email address until the token happens to rotate an hour later.
     */
    await user.getIdToken(true).catch(() => undefined);
  }

  // Send a verification email, but do not hard-gate sign-in on it — matching
  // the mobile app's behaviour exactly.
  await sendEmailVerification(user).catch(() => undefined);
}

export async function sendReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

/**
 * Google sign-in via a popup.
 *
 * A popup rather than a redirect because a redirect throws away all in-memory
 * state — including any live room — and returns to a cold page. The failure
 * mode (a blocker eating the popup) surfaces as `auth/popup-blocked`, which
 * `authErrors` turns into a readable message.
 */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // Always show the chooser rather than silently reusing the one signed-in
  // Google account, which is the behaviour of the native account picker.
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(getFirebaseAuth(), provider);
}

/** Reload the current user from Firebase and return the mapped app user. */
export async function reloadUser(): Promise<User | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  await user.reload();
  const fresh = getFirebaseAuth().currentUser;
  return fresh ? mapFirebaseUser(fresh) : null;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(getFirebaseAuth());
}
