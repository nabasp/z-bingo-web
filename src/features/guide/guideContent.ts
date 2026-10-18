/**
 * The Game Guide, as data.
 *
 * Written against the implementation rather than from memory — every number
 * here (2 to 3 players, boards from 3×3 to 8×8, one to five minutes a turn) is
 * the value the code actually enforces, and the win rule is the one in
 * `game.engine.ts`. If a rule changes, this file has to change with it, which
 * is why the numbers are stated once rather than sprinkled through prose.
 *
 * Structured rather than a wall of markup so the page can render it as real
 * headings and lists: a guide that a screen reader cannot navigate section by
 * section is not much of an accessibility feature.
 *
 * The mobile app keeps its own copy at
 * `bingo-react-native/src/features/guide/guideContent.ts`. The gameplay
 * sections are identical; the controls sections deliberately are not, because
 * the two platforms are genuinely operated differently.
 */
import {
  BOARD_KEYS,
  describeBoardKeyForReference,
  SHORTCUTS,
} from '@/lib/a11y/shortcuts';

export interface GuideItem {
  /** Optional lead-in, e.g. a key or a gesture. Rendered in bold. */
  term?: string;
  text: string;
}

export interface GuideSection {
  id: string;
  title: string;
  /** Read before the list. Optional — some sections are pure lists. */
  intro?: string;
  items: GuideItem[];
}

/**
 * Web controls, kept separate from the shared gameplay sections.
 *
 * The chords come from `SHORTCUTS` rather than being written out again, so the
 * guide cannot claim a key the app does not actually bind. The arrow-key
 * behaviour is the standard ARIA grid pattern that `BoardGrid` implements.
 */
export const WEB_CONTROL_SECTIONS: GuideSection[] = [
  {
    id: 'keyboard',
    title: 'Keyboard shortcuts',
    intro:
      'These work anywhere in a game, except while you are typing in a text box.',
    items: [
      { term: SHORTCUTS.focusBoard.keys, text: SHORTCUTS.focusBoard.description },
      { term: SHORTCUTS.toggleMic.keys, text: SHORTCUTS.toggleMic.description },
      {
        term: SHORTCUTS.exitGame.keys,
        text: `${SHORTCUTS.exitGame.description} Only while a game is running; there is no Escape while you are laying your board out.`,
      },
      {
        text: 'These are combinations rather than single letters on purpose: away from the board, screen readers claim bare letters like B and M for their own navigation, so a plain letter would never reach the game.',
      },
    ],
  },
  {
    id: 'board-keys',
    title: 'Moving around the board',
    intro:
      'The whole board is a single stop when you Tab through the page, so an 8×8 board does not cost you sixty-four presses. Once you are on it, the arrow keys take over.',
    items: [
      { term: 'Tab', text: 'Move between the board and the other controls.' },
      { term: 'Arrow keys', text: 'Move between cells.' },
      { term: 'Home / End', text: 'Jump to the start or end of the current row.' },
      {
        term: 'Ctrl + Home / Ctrl + End',
        text: 'Jump to the first or last cell of the board.',
      },
      { term: 'Enter or Space', text: 'Call the number you are on.' },
      {
        text: 'The board remembers where you were: leaving it and coming back with Alt + B puts you on the same cell.',
      },
    ],
  },
  {
    id: 'board-questions',
    title: 'Asking the board a question',
    intro:
      'While the board has focus, single letters work. Most of them answer about the cell you are on, so the answer follows your cursor. Where setting up and playing differ, both are given.',
    items: [
      // Both stages, side by side, because the same key asks the same question
      // of a board that is being laid out and one that is being played — and
      // that pairing is the reason there is only one set of letters to learn.
      ...BOARD_KEYS.map(spec => ({
        term: spec.keys,
        text: describeBoardKeyForReference(spec),
      })),
      {
        text: 'Single letters are safe here and nowhere else: the board is a grid, and screen readers switch to focus mode inside one and hand every key straight to the page.',
      },
      {
        text: 'They exist to close a gap. A sighted player spots at a glance that a row needs one more number — these say it out loud, so that is not an advantage you have to give up.',
      },
      {
        text: 'You are also told without asking, as soon as any of your lines comes down to a single cell.',
      },
    ],
  },
  {
    id: 'screen-reader-web',
    title: 'Using a screen reader',
    items: [
      {
        text: 'The board is a grid, so your screen reader’s table or grid commands work on it as well as the arrow keys do.',
      },
      {
        text: 'Each cell says where it is, what it holds and its state — for example “B2, 41, not marked”. Cells on a diagonal say so, because those are lines you cannot work out from the coordinate alone.',
      },
      {
        text: 'Cells are named like a chess board: a column letter, then a row number, counting from the top left. Settings can switch this to “R2, C2” if you prefer to hear the axes named.',
      },
      {
        text: 'A cell in a finished line adds “part of a completed line”.',
      },
      {
        text: 'An arrow key that runs off the board names the edge you are against — “Top left edge” — rather than doing nothing, which is indistinguishable from a key that did not register.',
      },
      {
        text: 'Nothing is ever disabled to stop you pressing it. A move that cannot be made is announced instead — silence would be invisible.',
      },
      {
        text: 'Every status is written in words as well as shown in colour, so nothing depends on being able to see a colour.',
      },
    ],
  },
  {
    id: 'mouse',
    title: 'Mouse and touch',
    items: [
      { text: 'Click or tap a number on your board to call it.' },
      {
        text: 'In board setup, click an empty cell to place the next number, or a filled one to clear it.',
      },
      {
        text: 'Every control is at least 44 pixels tall, so nothing needs a precise aim.',
      },
    ],
  },
];

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'what',
    title: 'What this game is',
    intro:
      'Bingo for two or three players, played in turns. Everyone gets the same numbers arranged differently, and the first person to complete enough lines wins.',
    items: [
      {
        text: 'Every player’s board holds the same set of numbers — 1 to 9 on a 3×3 board, 1 to 25 on a 5×5 — just in a different arrangement.',
      },
      {
        text: 'When anybody calls a number, it is marked on every board at once. So a call can complete a line for someone other than the caller.',
      },
      {
        text: 'Boards run from 3×3 up to 8×8. The host picks the size before the game starts.',
      },
    ],
  },
  {
    id: 'create',
    title: 'Creating a game',
    items: [
      { text: 'Choose Create Room on the home screen.' },
      {
        text: 'Pick the board size, how many players (2 or 3), and how long each turn lasts — 1, 2, 3, 4 or 5 minutes.',
      },
      {
        text: 'You get a room code made of two words, like “brave-otter”. Share it with the people you want to play with.',
      },
      {
        text: 'A room waits a while for somebody to join. If nobody does, it closes itself and tells you why.',
      },
    ],
  },
  {
    id: 'join',
    title: 'Joining a game',
    items: [
      { text: 'Choose Join Room and type the code you were given.' },
      {
        text: 'Capitals, spaces and underscores are all fine — “Brave Otter” finds the same room as “brave-otter”.',
      },
      {
        text: 'You can be in one room at a time. If you are already in another, the app says so and names it.',
      },
      {
        text: 'A room that is already playing cannot be joined partway through.',
      },
    ],
  },
  {
    id: 'friends',
    title: 'Playing with friends',
    items: [
      {
        text: 'Add friends by their handle on the Friends screen, then send an invitation from Play with Friends.',
      },
      {
        text: 'An invitation is live for a couple of minutes. Your friend sees it wherever they are in the app and can accept or decline.',
      },
      {
        text: 'Once enough friends accept, the room is created for everyone at once — nobody has to type a code.',
      },
      {
        text: 'Friends who are already in a game show as busy, so you cannot invite someone who could not come anyway.',
      },
    ],
  },
  {
    id: 'setup',
    title: 'Setting up your board',
    intro:
      'Before play starts, everyone builds their own board by hand. It starts empty, and you place the numbers by choosing cells.',
    items: [
      {
        text: 'Choose any empty cell and the next number drops into it — 1 first, then 2, and so on. You never type a number.',
      },
      {
        text: 'The order you choose cells is what decides the arrangement. Choose the bottom-right cell first and it gets the 1.',
      },
      {
        text: 'Made a mistake? Choose a filled cell to empty it. Its number goes back into the pool and is the next one placed, so you can move a number by clearing one cell and choosing another.',
      },
      {
        term: 'Shuffle',
        text: 'Rearranges the numbers you have already placed. It never adds a number and never changes which numbers are on the board — the empty cells stay exactly where they are.',
      },
      {
        text: 'Choose Continue when you are happy. Your board locks and the game starts once everyone has locked theirs.',
      },
      {
        text: 'Changed your mind? Leave Room gets you out — it asks first, because the others are waiting on you.',
      },
    ],
  },
  {
    id: 'turns',
    title: 'Taking turns',
    items: [
      {
        text: 'Players take it in turns. The banner at the top of the board says whose turn it is and how long is left.',
      },
      {
        text: 'On your turn, choose any number on your board that has not been called yet. That calls it for everybody.',
      },
      {
        text: 'Choosing a number that is already called, or choosing one when it is not your turn, does nothing — and the app says why rather than staying silent.',
      },
      {
        text: 'If a turn runs out of time it simply passes to the next player. Nobody is penalised.',
      },
    ],
  },
  {
    id: 'winning',
    title: 'Completing lines and winning',
    items: [
      {
        text: 'A line is a full row, a full column, or either diagonal, with every number on it called.',
      },
      {
        text: 'Above your board is a word — BUS on a 3×3, GAME on 4×4, BINGO on 5×5, and longer words on bigger boards. You earn one letter per completed line, and it is struck through as you earn it.',
      },
      {
        text: 'Spell the whole word and you win. The word is always exactly as long as the board is wide, so a 5×5 needs five lines.',
      },
      {
        text: 'One call can finish the last line for more than one player. There are no draws: the person who made the call wins their own call, and otherwise the earlier seat takes it.',
      },
      {
        text: 'When somebody wins, everybody goes to the results screen with the final standings.',
      },
    ],
  },
  {
    id: 'again',
    title: 'Playing again',
    items: [
      {
        text: 'Anyone on the results screen can choose Play Again — it is not only for whoever made the room.',
      },
      {
        text: 'The other players are asked whether they want another round. Everyone has to agree.',
      },
      {
        text: 'If anybody says no, or nobody answers within about thirty seconds, the room closes and everyone returns home. Nobody is dropped from a game without being told.',
      },
      {
        text: 'When everyone agrees you go back to board setup with fresh boards.',
      },
    ],
  },
  {
    id: 'voice',
    title: 'Talking to the other players',
    items: [
      {
        text: 'Voice chat starts automatically when you enter a room, with your microphone live, so you can just talk.',
      },
      {
        text: 'The Voice control mutes and unmutes you. Its label always says the current state in words.',
      },
      {
        text: 'A ripple appears beside a player’s name while they are speaking, and each player’s mic state is written next to their name.',
      },
      {
        text: 'Your microphone mutes itself while the app is in the background, and unmutes when you come back — unless you muted yourself deliberately.',
      },
      {
        text: 'If the microphone is refused or unavailable, the app says so and the game carries on normally. Voice is never required to play.',
      },
    ],
  },
  {
    id: 'sound',
    title: 'Sound and speech',
    intro: 'All of these are switchable in Settings.',
    items: [
      { term: 'Music', text: 'Background music during lobbies and matches.' },
      {
        term: 'Sound effects',
        text: 'Numbers called, lines completed, and win or lose cues.',
      },
      {
        term: 'Spoken updates',
        text: 'Game events announced as they happen.',
      },
      {
        term: 'Speak aloud',
        text: 'Has the game read updates in its own voice, with no screen reader needed. Leave it off if you use one — it would read everything twice.',
      },
      {
        term: 'Board coordinates',
        text: 'Switches between “B2” and “R2, C2”.',
      },
      {
        term: 'Vibration',
        text: 'A short buzz when you mark a number or complete a line.',
      },
      {
        text: 'The Sound control on the game screen turns sound effects off and on without leaving the game.',
      },
      {
        text: 'Screen-entry announcements and “that did not work” messages are always spoken, even with spoken updates off — they are how you find your way around, not commentary.',
      },
      {
        text: 'Moving between cells cuts off whatever was being said, so exploring the board quickly never leaves you waiting on an old announcement.',
      },
    ],
  },
];
