import { cn } from '@/lib/cn';
import { Card } from '@/components/ui';
import type { RecentGame } from '../types';

/** Small tile summarizing a past game (Won/Lost). */
export function RecentGameTile({ game }: { game: RecentGame }) {
  const won = game.outcome === 'won';
  return (
    <Card className="flex flex-1 flex-col gap-1">
      <span
        className={cn(
          'text-sm font-semibold',
          won ? 'text-emerald-400' : 'text-rose-400',
        )}>
        {won ? 'Won' : 'Lost'}
      </span>
      <span className="text-sm text-muted-foreground">
        {game.players} players · {game.when}
      </span>
    </Card>
  );
}
