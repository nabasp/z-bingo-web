/**
 * Every route path in one place.
 *
 * The mobile app centralises its route names the same way
 * (`bingo/src/constants/routes.ts`) so screens never hardcode strings and the
 * navigator types stay in step. Here it also keeps redirects, guards and links
 * from drifting apart.
 */
export const PATHS = {
  // Unauthenticated
  signIn: '/signin',
  signUp: '/signup',
  forgotPassword: '/forgot-password',

  // Authenticated shell
  home: '/',
  profile: '/profile',
  settings: '/settings',

  // Game flow. The server's room status decides which of these you are on —
  // see `useGameFlowNavigation`.
  createRoom: '/game/create',
  joinRoom: '/game/join',
  lobby: '/game/lobby',
  boardSetup: '/game/setup',
  waiting: '/game/waiting',
  play: '/game/play',
  result: '/game/result',
} as const;

export type Path = (typeof PATHS)[keyof typeof PATHS];
