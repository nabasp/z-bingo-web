import { memo } from 'react';
import { Button, Card } from '@/components/ui';
import { sentence } from '@/lib/a11y/phrases';
import { PlayerAvatar } from '@/features/game/components';
import type { PublicUser } from '../types';
import { userLabel } from '../a11y/socialSpeechEvents';

export type SearchRelation = 'none' | 'friend' | 'incoming' | 'outgoing';

export interface SearchResultRowProps {
  user: PublicUser;
  seatIndex: number;
  /** How this person already relates to the searcher. */
  relation: SearchRelation;
  onAdd: () => void;
}

const RELATION_LABEL: Record<SearchRelation, string> = {
  none: '',
  friend: 'Already your friend',
  incoming: 'Has already sent you a request',
  outgoing: 'Request already sent',
};

/**
 * A search hit, with the one action that makes sense for it.
 *
 * Existing relationships are stated, not hidden. A result that silently offers
 * no button leaves a listener wondering whether they missed it; "Already your
 * friend" answers the question they were about to ask.
 */
export const SearchResultRow = memo(function SearchResultRow({
  user,
  seatIndex,
  relation,
  onAdd,
}: SearchResultRowProps) {
  const note = RELATION_LABEL[relation];

  return (
    <Card
      role="listitem"
      aria-label={sentence(userLabel(user), note || undefined)}
      className="flex w-full items-center justify-between gap-3">
      <div aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-3">
        <PlayerAvatar name={user.name} seatIndex={seatIndex} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base font-semibold text-foreground">
            {user.name}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            @{user.handle}
            {note ? ` · ${note}` : ''}
          </span>
        </div>
      </div>

      {relation === 'none' ? (
        <Button
          size="sm"
          className="shrink-0"
          aria-label={`Send a friend request to ${user.name}`}
          onClick={onAdd}>
          Add
        </Button>
      ) : (
        <span aria-hidden="true" className="shrink-0 text-sm text-muted-foreground">
          {note}
        </span>
      )}
    </Card>
  );
});
