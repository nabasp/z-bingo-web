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
  type ActionCodeSettings,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { PATHS } from '@/routes/paths';
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
    emailVerified: user.emailVerified,
    // `providerData`, not `providerId`: the latter is always 'firebase' on the
    // user itself. An account can carry several providers at once once linked,
    // and the password one is what the verification gate is about.
    hasPasswordProvider: user.providerData.some(p => p.providerId === 'password'),
  };
}

/**
 * Where Firebase's hosted verify/reset page sends the user when it is done.
 *
 * Without this the flow dead-ends on a Firebase-branded page with nothing to
 * click, usually in a mail app's in-app browser. Sign-in is the right landing
 * spot for both mails: a password reset ends by signing in with the new one,
 * and a confirmation is often opened on a different device than the one the
 * account was created on.
 *
 * The origin must be on Firebase Auth's **Authorized domains** list, or the SDK
 * rejects the call with `auth/unauthorized-continue-uri` — hence deriving it
 * from the running origin rather than hardcoding a host per environment.
 */
function continueToSignIn(): ActionCodeSettings {
  return { url: `${window.location.origin}${PATHS.signIn}`, handleCodeInApp: false };
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

  // Sign-up is gated on confirming this address, so the mail is the next step
  // of the flow rather than a background nicety. A failure to send is still not
  // fatal — the account exists, and `VerifyEmailPage` offers a resend.
  await sendEmailVerification(user, continueToSignIn()).catch(() => undefined);
}

/**
 * Re-send the confirmation mail to the signed-in user.
 *
 * Unlike the send during sign-up, this one is a direct response to a button, so
 * it lets errors through — a silent no-op on a click the user is watching for
 * is worse than `auth/too-many-requests` rendered as a message.
 */
export async function sendVerification(): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return;
  await sendEmailVerification(user, continueToSignIn());
}

export async function sendReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email, continueToSignIn());
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
  if (!fresh) return null;

  /*
   * Force a fresh ID token once the address is confirmed.
   *
   * `reload()` updates the local user record, but the token already in hand is
   * a snapshot that still claims `email_verified: false` — for up to an hour.
   * The backend reads that claim (`isUnverifiedPasswordUser`), so without this
   * the player would clear the gate on screen and still be refused by the API
   * and the socket until the token happened to rotate.
   */
  if (fresh.emailVerified) await fresh.getIdToken(true).catch(() => undefined);

  return mapFirebaseUser(fresh);
}

export async function signOutFirebase(): Promise<void> {
  await signOut(getFirebaseAuth());
}
