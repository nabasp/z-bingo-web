import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequireGuest, RequireRoom } from './guards';
import { NotFoundPage } from './NotFoundPage';
import { PATHS } from './paths';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage';
import { SignInPage } from './auth/SignInPage';
import { SignUpPage } from './auth/SignUpPage';
import { HomePage } from './app/HomePage';
import { ProfilePage } from './app/ProfilePage';
import { SettingsPage } from './app/SettingsPage';
import { BoardSetupPage } from './game/BoardSetupPage';
import { CreateRoomPage } from './game/CreateRoomPage';
import { GameBoardPage } from './game/GameBoardPage';
import { GameLayout } from './game/GameLayout';
import { JoinRoomPage } from './game/JoinRoomPage';
import { LobbyPage } from './game/LobbyPage';
import { ResultPage } from './game/ResultPage';
import { WaitingPage } from './game/WaitingPage';

/**
 * The route tree.
 *
 * Mirrors the mobile navigator hierarchy: a guest group and an authenticated
 * group that can never both be mounted (`RootNavigator`), the tabbed shell
 * (`MainTabs`), and the game flow nested inside it (`GameNavigator`).
 *
 * Two guards do the work a native stack does implicitly. `RequireAuth`/
 * `RequireGuest` replace the conditional stacks; `RequireRoom` covers something
 * a native app never has to think about — a URL can be typed, bookmarked or
 * refreshed, so the live game pages need to say what happens when you arrive
 * without a room.
 */
export const router = createBrowserRouter([
  {
    element: <RequireGuest />,
    children: [
      { path: PATHS.signIn, element: <SignInPage /> },
      { path: PATHS.signUp, element: <SignUpPage /> },
      { path: PATHS.forgotPassword, element: <ForgotPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: PATHS.home, element: <HomePage /> },
          { path: PATHS.profile, element: <ProfilePage /> },
          { path: PATHS.settings, element: <SettingsPage /> },
          {
            // Every game route shares the server-driven navigation.
            element: <GameLayout />,
            children: [
              { path: PATHS.createRoom, element: <CreateRoomPage /> },
              { path: PATHS.joinRoom, element: <JoinRoomPage /> },
              {
                element: <RequireRoom />,
                children: [
                  { path: PATHS.lobby, element: <LobbyPage /> },
                  { path: PATHS.boardSetup, element: <BoardSetupPage /> },
                  { path: PATHS.waiting, element: <WaitingPage /> },
                  { path: PATHS.play, element: <GameBoardPage /> },
                  { path: PATHS.result, element: <ResultPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
