/**
 * The social feature's slice of the socket contract.
 *
 * Re-exported rather than redefined: friends and invitations travel on the
 * same socket as the game, so the server has one `socket.types.ts` and the
 * client has one mirror of it. This keeps social code importing from its own
 * feature without a second, drifting copy of the payloads.
 */
export type {
  Friend,
  FriendRequest,
  FriendsSnapshot,
  GameInvitePayload,
  InviteAnswer,
  InviteEndedPayload,
  InviteEndReason,
  InviteeStatus,
  PartyEndedPayload,
  PartyEndReason,
  PartyInvitee,
  PartySnapshot,
  Presence,
  PublicUser,
  RoomSnapshot,
} from '@/features/game/types/events';
