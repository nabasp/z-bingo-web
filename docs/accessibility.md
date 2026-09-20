# Accessibility

How the web game works from the keyboard, with a screen reader, and with neither.

**Goal:** a blind player can sign in, create or join a room, lay out a board, play a full match and
hear the result, without ever needing to see the screen.

This file is the reasoning. The key tables themselves are **not** copied here — they live in
[`shortcuts.ts`](../src/lib/a11y/shortcuts.ts) and
[`boardActions.ts`](../src/features/game/a11y/boardActions.ts), and Settings, the in-app guide and
the spoken `H` help are all generated from them. A table written out twice is a table that will
disagree with itself.

---

## The two stages share one set of keys

The same letters serve **board setup** and **play**, and they ask the same question on both. What
changes is the answer:

| Key | Setting up | Playing |
| --- | --- | --- |
| Arrows | Move the cursor one cell | Move the cursor one cell |
| Enter | Put the next number in this cell, or take it out | Call this number |
| Alt + B | Jump to the board, and back | Jump to the board, and back |
| R / C / D / A | Which cells in this row / column / diagonal / anti-diagonal are still **blank** | What that line still needs for a **strike** |
| P | Read the whole board back, row by row | The same |
| S | — | How far everyone is through the target word |
| M | Mute or unmute | Mute or unmute |
| F | Fill the cells you have not chosen, at random | — |
| U | Undo the last change to your board | — |
| H | Read every shortcut out | Read every shortcut out |
| Escape | — | Leave the game, after confirming |

That parallel is the point: one set of letters to learn rather than two, and the letter is the word
— `R` for row, `D` and `A` for the two diagonals — which is the only mnemonic available to someone
learning these by ear.

**The pairing is also where the one real bug lived.** `lineProgress` answered about *marked* cells
on both stages. A board being laid out is never marked, so `R`, `C`, `D` and `A` answered "needs
every cell" on every line of every board — true, and useless to the person building it.
[`LineBasis`](../src/features/game/a11y/lineProgress.ts) is the word that changes underneath the
key: `'filled'` during setup, `'marked'` during play.

### Why some are bare letters and some are chords

Both, for the same reason. NVDA and JAWS reserve bare letters in *browse* mode — `B` jumps to the
next button, `H` to the next heading — and the keystroke never reaches the page. So anything that
must work from anywhere is a chord: Alt + B, Alt + M, Escape.

Inside the board that reservation does not apply. `role="grid"` with focusable `gridcell`s puts
both screen readers into *focus* mode, where every key is handed to the page, and the grid's own
`keydown` handler consumes them first. That is what makes the single letters safe **there and
nowhere else** — and the board is the only place their answers mean anything anyway, since most of
them are relative to the cell you are on.

`H` is the clearest case: as a global binding it would be swallowed by heading navigation before it
ever reached us.

### A key that does nothing must not be swallowed

`BOARD_ACTIONS` and `BOARD_KEYS` each carry a `stages` field, and the grid dispatches through
`actionsFor(stage)`. A key the current screen cannot answer falls through to the browser rather
than being `preventDefault`ed into silence.

This is a real failure, not a hypothetical one: the setup page bound the bare `M` but never passed
a mic handler, so the key matched, was swallowed, and did nothing — while the spoken help
cheerfully announced it. `stages` is what makes that unrepresentable, because the help is generated
from the same field the dispatch reads.

---

## What the cursor says

`cellLabel` ([source](../src/features/game/a11y/cellLabel.ts)) is pure — primitives in, one string
out — which is what lets each cell build its own label *inside* its `memo` boundary. Position
always leads, so you know where you are before you are told what is there:

- Setting up: `"B1, 2. filled"`, or `"B1, blank"`.
- Playing: `"B1, 2. not marked"`, plus `"part of a completed line"` where it applies.

"blank" rather than "empty" throughout, including in the whole-board readout, so one thing is never
named two ways.

### Two paths, and why the cursor speaks on only one of them

There are two ways this app produces speech, and they must never both fire:

1. **A screen reader.** Moving focus to a cell is enough — the reader announces the `aria-label` it
   has just been handed. Nothing else is needed, and anything else would be a second voice.
2. **The app's own voice** (`speechEngine.ts`, Settings → *Speak aloud*), which a keyboard player
   with no screen reader relies on. It gets none of that for free: focus moves and nothing is said.

So `moveFocus` and the Alt + B landing speak the cell **only when `isSelfVoiceEnabled()`**. Before
this, arrowing around the board was completely silent for path 2 — the first row of the spec's
announcement table, and the one a keyboard-only player uses most.

Alt + B reads the landing cell's `aria-label` straight off the DOM rather than rebuilding the
sentence, so it is by construction the same thing the screen reader would have said.

---

## Speech priority

Three levels, and they are `TIER` in [`Announcer.ts`](../src/lib/a11y/Announcer.ts) — not a
separate concept to keep in step with one:

| Level | `TIER` | Used for | Behaviour |
| --- | --- | --- | --- |
| 1 — Interruptive | `interrupt` | Cursor movement, call confirmations, win announcements, rejections | Cuts off what is playing, discards what is queued, never deduped |
| 2 — Polite | `notify` | Other players' calls, joins and leaves, mic state | Waits its turn in the next batch |
| 3 — On demand | `summary` | `P` `R` `C` `D` `A` `S`, and the `H` help | Interrupts, never deduped, exempt from the 300-character batch cap |

`TIER.interrupt` passing `dedupeMs: 0` is the point of it. The 1 s dedupe exists to stop the
*server* saying the same thing twice; applied to a player's own keypresses it meant arrowing
B2 → B3 → B2 said "B2" once and then fell silent under anyone moving quickly.

Call sites pass `{ ...TIER.x, dedupeKey: … }` rather than assembling flags by hand, so the level a
message belongs to is legible where it is spoken.

---

## What the game says on its own

`deriveSpeechEvents` ([gameSpeechEvents.ts](../src/features/game/a11y/gameSpeechEvents.ts)) is the
speech twin of the audio diff, and takes the audio events as input rather than re-deriving state —
so the two can never disagree.

| Event | Spoken |
| --- | --- |
| Game start | "Game started. 3 players: You, Ann and Bob. Target word BINGO" |
| A number called | `"B2, 25, called by John. Marked on your board"` — or `"25, called by John. Not on your board"` |
| Your own call | `"B2, 25 marked"` |
| One cell from a strike | "1 strike away: Row 1 at C1" |
| Line complete | "Row 1 complete. Letter B earned. 2 lines of 5" |
| Your turn | "Your turn" |
| Grid edge | "Top left edge" — named, so you know *which* wall you hit |
| Result | "You win. John second, you third" — **and nothing else** |

**The cell leads on a call.** That is what a sighted player reads off the board, and what tells a
listener whether the call is worth turning towards. A number that is not on your board has no
coordinate, and one is not invented — the cell is simply left out.

**Your own call is announced twice, and heard once.** Pressing Enter says it immediately, because a
confirmation that arrives a round trip late reads as lag. The server's echo carries the *same*
`dedupeKey`, so the announcer drops whichever lands second. (They did not match before, so your own
calls were genuinely said twice.)

**The result is spoken alone.** When the game ends, call and progress commentary is dropped — the
most important moment must not be buried.

Commentary follows the `speech` channel and can be turned off in Settings. **Navigation and the
rejection messages deliberately bypass that switch** — they are how you move around at all, not
colour commentary.

---

## Board setup, and undo

The board is laid out by choosing cells in an order you pick; each press drops in the lowest number
not yet placed, and pressing a filled cell returns its number to the pool. For one cell that is the
whole correction story, and it is why no sequence of presses can produce a duplicate or a gap.

`U` exists for the two presses that move cells you never chose — **Shuffle** and **Random Fill** —
and for the player who cannot check what just happened by looking. Thirty steps of history: deep
enough for a run of mistaken presses, shallow enough that it is not a way to rebuild a board from
scratch.

Every change speaks, in the words the cursor already uses:

- A placement: `"B2, 9. filled"`. A clear: `"B2, blank"`.
- `F`: "Cells are filled with random numbers."
- `U`: "Undo", plus the restored cell **when exactly one moved** — after a shuffle, naming one of
  sixty-four would mislead. On an exhausted history: "Nothing to undo", because silence is
  indistinguishable from a dropped keypress and the usual response to that is to press harder.

Undo is a button as well as a key, so it is not reachable by keyboard alone.

---

## Kept in sync with the mobile app

The pure modules under `src/features/game/a11y/` — `boardActions`, `lineProgress`, `cellLabel`,
`boardReadout`, `gameSpeechEvents`, `boardCoords`, `edges` — are shared **verbatim** with
`bingo-react-native`, which holds the originals. A player who learns what "row progress" says on
one must hear the same sentence on the other, so the wording is decided once and each platform
supplies only the trigger: keys here, screen-reader actions there.

Changing any of them means changing both. See
[`bingo-react-native/docs/accessibility.md`](../../bingo-react-native/docs/accessibility.md).

---

## What is still missing

- **No real screen-reader pass has been done on this work.** Everything here is verified by unit
  tests, types and lint — but the acceptance test is playing a full match with the screen off, and
  that has not happened yet. NVDA, JAWS and VoiceOver all need separate passes: the browse/focus
  mode behaviour the single letters depend on is per-reader.
- **No `edge_bump` sound exists**; the edge announcement borrows `board_invalid`.
- **Colour contrast has not been re-checked** since the Undo button was added to the setup row.
- **`P` on an 8×8 is 64 numbers.** `allowLong` exempts it from the batch cap, so it is said in
  full — but it has not been listened to end to end at that size.

## Testing it yourself

```bash
npm test          # vitest, including the accessibility assertions
npm run lint
npx tsc -b
```

Then, in a browser:

1. **Setup.** Alt + B into the board. With *Speak aloud* on, arrow around: every cell must be
   spoken, and one with no number must say "blank". Press Enter and hear "B2, 1. filled".
2. Press `R`, `C`, `D` and `A` on a half-filled board and check each answer against the screen.
   They must name the cells that are still **blank**, not every cell on the line.
3. `P` reads the board back. `F` fills the rest and says so. `U` puts it back. `M` toggles the mic.
   `H` reads every key out, including Alt + B and Alt + M and **not** Escape. `S` does nothing.
4. **Play.** The same keys, now answering about strikes. Enter on your own number says
   "B2, 9 marked" — once, not twice. An opponent's call says "B2, 25, called by John".
5. Arrow into a wall: the edge is named, once, and the page does not scroll.
6. Turn *Speak aloud* **off** and a screen reader **on**, and repeat 1 and 4. Nothing may be said
   twice.
