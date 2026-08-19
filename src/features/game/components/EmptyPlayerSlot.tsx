/** Dashed placeholder row for an unfilled player seat. */
export function EmptyPlayerSlot() {
  return (
    <li className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/40 p-5">
      <span aria-hidden="true" className="text-lg text-muted-foreground">
        +
      </span>
      <span className="text-sm font-medium text-muted-foreground">
        Waiting for player
      </span>
    </li>
  );
}
