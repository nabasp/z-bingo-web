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

---

## The loading gate

Nothing renders until the game's sounds are in memory.
[`AppLoadingGate`](../src/features/loading/AppLoadingGate.tsx) wraps the router, so the first
screen a player sees is a loading screen and the first cue of a match is a `play()` call rather
than a download.

**The bug it fixes.** `AudioManager.preload()` builds the audio elements but sets
`preload="none"` — no bytes. The clips only started downloading at `unlock()`, on the first click
anywhere in the app, and 6.2 MB of WAV then raced the game screen. A cue asked to play while its
file was still arriving simply did not.

### Why it is fast

Three things, in order of how much they matter:

| | Before | After |
| --- | --- | --- |
| Format | 48 kHz 16-bit stereo WAV | 128 kbps stereo AAC |
| Whole set | 6.2 MB | 507 KB |
| **Blocks the app** | **6.2 MB** | **292 KB** |
| Cache headers on `/audio/` | none | 30 days |

**Compression did most of it.** The clips are 33 seconds of short UI blips, and as PCM that is
6.2 MB. AAC at 128 kbps keeps both channels and the full sample rate for 507 KB — a 92% cut for
material nobody is listening to critically. The sources live in `audio-src/`, outside `public/` so
they never ship, and `npm run encode:audio` produces what does. `soundRegistry.ts` still names the
mobile app's `.wav`, because it is shared verbatim with an app where the clips are on the device
and size costs nothing; `webSource()` translates the extension and the difference stays out of the
shared file.

**Two passes, not one.** The gate waits only on `CRITICAL_SOUNDS` — the clips a game cannot start
without — and fetches the other seventeen once the player is already in, where a lobby chime
arriving a second late costs nothing. Sequential rather than parallel, so the second pass does not
compete for the connection with the only moment that matters. Together with the format change that
is 6.2 MB on the critical path before, 292 KB after: **22× less**.

**They are cached now.** `/audio/` previously had no cache headers at all, so every production
visit re-validated all 28 clips before the loading screen could open — the one thing it exists to
avoid. Thirty days rather than the `immutable` year the Vite bundle gets, because these filenames
carry no content hash and a replaced clip has to be able to reach people who already hold the old
one.

### Fetched, not preloaded

Clips are pulled with `fetch` and handed to their element as a `blob:` URL, rather than the more
obvious `preload="auto"` plus a wait for `canplaythrough`. The obvious version works in Chrome and
fails on iOS Safari, which ignores `preload` outright and touches the network only when `play()` is
called — the event never arrives, every clip times out, and a healthy iPhone is told the game
failed to load. `fetch` behaves the same everywhere, reports a real HTTP status so a 404 is a
failure rather than a silence, and is abortable.

### What blocks, and what does not

[`CRITICAL_SOUNDS`](../src/lib/audio/preloadPlan.ts) is the subset the game will not start without
— the core loop, the clock, progress and the result. Anything else that fails is named on the
loading screen, stays silent in play, and is never a reason to block: holding a player out of a
match the server has already started, with a turn clock running, because a copy-code chime 404'd
would be worse than the delay this system exists to remove.

Retry reloads only what failed. Elements are reused, both listeners and the timeout are removed on
every path out of `fetchOne`, and a clip already in memory short-circuits — so nothing here can
accumulate a second `Audio` instance, a duplicate listener or a stray request.

### Accessibility

- **A heading**, focused on arrival. It reads `Zendalona Bingo, loading the game`: a title screen
  to look at, and a statement of which screen this is to anyone who cannot see the progress bar.
  The text never changes, because focus is parked on it and a heading that rewrote itself under
  that focus would be re-read on every phase.
- **No progress bar on a warm cache.** Every visit after the first settles in a few milliseconds,
  and a bar that appeared and vanished in that time reads as a glitch rather than as progress, so
  it is held back for 250 ms. The container keeps a fixed minimum height either way, so Start never
  moves out from under the pointer.
- **Phase announcements only** — "Loading sounds.", then "Ready." Progress is never announced:
  twenty-eight "n of 28" updates would interrupt each other the whole way down and tell a listener
  nothing they can act on. The count is on screen, and on the progress bar's `aria-valuetext` for
  anyone who navigates to it.
- **Nothing on this screen is a live region.** The announcer already owns a pair, mounted before
  React renders, and every phase goes through it; a second `role="status"` here would say the same
  sentence twice, one of them unpaced.
- **Focus follows the work**: the heading while loading, then Start when ready or Retry on failure.
- **"Ready" and failures interrupt; the in-progress line does not.** Not politeness — a race. The
  screen's own arrival announcement is assertive, and an assertive utterance clears what is
  pending, so a polite "Ready." raised in the same breath was discarded. On a warm cache that
  window is a few milliseconds, which is exactly when it happened.

### Start, and why it is a button

Browsers block audio until the page has had a genuine user gesture. Because the gate runs at boot,
nothing has been clicked yet — so "Ready" would be a lie without a press to back it. The Start
button is that press: one gesture, once per session, and it is also the keyboard and screen-reader
entry point into the app.

### Two races only a browser showed

Both were found by running it, not by the tests, and both are now pinned by tests:

- **React's development double-mount tore down the in-flight pass**, because `App`'s cleanup
  disposed a page-lifetime singleton. The aborted requests were then reported as *failures*, and
  the loading screen announced that eleven game sounds had not loaded — a sentence a blind player
  has no way to check and every reason to believe. `release()` now marks a pass `cancelled`, and
  `App` no longer disposes the manager.
- **`useAnnounceOnFocus` parks focus on a 120 ms delay.** This is the one screen that can finish
  sooner than that, and on a warm cache it did: focus moved to Start, the timer fired, and focus
  was dragged back to the heading — leaving a keyboard player pressing Enter on a heading. The
  screen owns its own arrival and focus now.

---

## History and rankings

Recent games and top players on Home, plus Game History, Game Details and the
Leaderboard (`src/features/history/`). The scoring rules are in
`bingo-server/docs/RESULTS.md`; what follows is how they are presented.

- **One row, one sentence, result first.** A history row is a link whose name
  reads "Bingo #A82F. Won, first place. October 6, 2026. 3 players. Lasted 4
  minutes 12 seconds" — held in visually hidden text, with the visible layout
  `aria-hidden` so it is not read again in fragments.
- **The link's name starts with its visible text** (WCAG 2.5.3, *Label in
  Name*). The mobile app spells the id out as "A 8 2 F"; the web uses the
  visible "Bingo #A82F" instead, so a voice-control user can say "click Bingo
  #A82F" and be understood. `historyItemLabel(item, { title: 'visible' })`.
- **Every number is named.** "Rank 1. Ann. 125 points. 48 games, 21 wins. 43.8
  percent win rate" — never a bare "1" or "125" in browse mode.
- **Results are words, not colours.** Won, Lost, Abandoned, Cancelled are
  always written; the tint is decoration. Your own leaderboard row says "You".
- **Your ranking comes first** on the leaderboard, under its own heading — the
  one row about you may not be on the first page at all.
- **"Load more", not infinite scroll.** Content that appears by itself as you
  scroll is invisible to a keyboard and moves the page under a screen reader.
- **Focus moves to the first new row** after a page loads. This is a bug fix,
  not a nicety: on the last page "Load more" is removed while it has focus,
  and the browser drops focus to `<body>`. `useFocusOnLoadMore`.
- **Filters are toggle buttons** in a labelled group, with `aria-pressed`. Not
  a tablist: they filter one list in place, and a tablist would promise
  arrow-key behaviour and panels that do not exist.
- **Changes are spoken once.** "Showing wins. 3 games." after a filter; "20
  more games loaded." after a page. Polite, and never the running count.
- **A stale answer is never shown.** Switching filters while a request is in
  flight drops the earlier answer rather than showing wins under "Losses".
- **Game details use a description list** for date, duration, board and word,
  so each value is paired with its name, and an ordered list for the
  standings.

## What is still missing

- **The loading screen's failure state has not been seen in a browser.** A real 404 is confirmed
  to be detected and classified as blocking, and the error UI, its focus move and the
  retry-only-what-failed rule are covered by tests — but the rendered error screen itself has only
  been seen in jsdom, because the browser's HTTP cache makes a clip hard to un-serve once it has
  loaded.
- **History and rankings have not been tried with a screen reader.** The
  labels, focus moves and announcements are asserted in tests; what NVDA, JAWS
  and VoiceOver actually say for the hidden-text rows has not been listened to.
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

1. **The loading gate.** Reload with an empty cache. The first thing on screen is "Loading game"
   with a progress bar; when it says Ready, focus must already be on Start, and Enter must enter
   the app. Reload again with a warm cache: the same screen, but immediate.
2. **Setup.** Alt + B into the board. With *Speak aloud* on, arrow around: every cell must be
   spoken, and one with no number must say "blank". Press Enter and hear "B2, 1. filled".
3. Press `R`, `C`, `D` and `A` on a half-filled board and check each answer against the screen.
   They must name the cells that are still **blank**, not every cell on the line.
4. `P` reads the board back. `F` fills the rest and says so. `U` puts it back. `M` toggles the mic.
   `H` reads every key out, including Alt + B and Alt + M and **not** Escape. `S` does nothing.
5. **Play.** The same keys, now answering about strikes. Enter on your own number says
   "B2, 9 marked" — once, not twice. An opponent's call says "B2, 25, called by John".
6. Arrow into a wall: the edge is named, once, and the page does not scroll.
7. Turn *Speak aloud* **off** and a screen reader **on**, and repeat 2 and 5. Nothing may be said
   twice.
