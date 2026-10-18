# z-bingo-web

The Bingo web client: React, Vite and Tailwind, talking to `bingo-server` over
REST and one Socket.IO connection.

## Running it

Deployment and configuration — local and production, for this repo and the
backend — live in **[`z-bingo-deployment`](https://github.com/zendalona/z-bingo-deployment)**,
which is the single source of truth. It owns the Compose file, the environment
files and every start/stop/deploy script. Do not add run or deploy instructions
here.

`Dockerfile`, `.dockerignore` and `nginx.conf` are built and used by that stack,
and are the only deployment files that belong in this repo. Note that `VITE_*`
values are inlined into the bundle at **build** time, so changing one means
rebuilding the web image.

## Tests

```bash
npm test          # vitest, including the accessibility assertions
npm run lint
npx tsc -b        # typecheck
```

## Sound assets

`audio-src/` holds the authored clips — 48 kHz 16-bit stereo WAV, the same files the mobile app
ships. They are **not** served. `public/audio/` holds the 128 kbps AAC the browser actually
downloads, which is 92% smaller for the same 33 seconds of audio and is what makes the loading
screen quick.

```bash
npm run encode:audio   # audio-src/*.wav -> public/audio/*.m4a
```

Re-run it after changing or adding a clip, and commit both. The script uses `ffmpeg` where it
exists and falls back to `afconvert`, which is built into macOS.

## Accessibility

How the game works from the keyboard and with a screen reader — the shortcut
model, what gets spoken and why, and what is still untested — is in
**[`docs/accessibility.md`](docs/accessibility.md)**. The key tables themselves
are generated from `src/lib/a11y/shortcuts.ts`, so Settings, the in-app guide
and the spoken help cannot describe a key the app does not bind.
