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
  guide: '/guide',
  friends: '/friends',
  playWithFriends: '/play-with-friends',

  // Game flow. The server's room status decides which of these you are on —
  // see `useGameFlowNavigation`.
  createRoom: '/game/create',
  joinRoom: '/game/join',
  lobby: '/game/lobby',
  boardSetup: '/game/setup',
  waiting: '/game/waiting',
  play: '/game/play',
  result: '/game/result',

  // Play With Bot. A standalone single-player mode: no room is created, so
  // these deliberately sit outside `/game` and outside the room guard.
  bot: '/bot',
  botBoardSetup: '/bot/board',
  botPlay: '/bot/play',
  botResult: '/bot/result',
} as const;

export type Path = (typeof PATHS)[keyof typeof PATHS];
