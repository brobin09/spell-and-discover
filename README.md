# Spell & Discover

A browser-based spelling and dictionary app for kids. Type letters, hear
whether it's a real word or name, get a kid-friendly definition and picture,
or — if it's not a word yet — discover a real word hiding in the letters you
typed.

- Speech is generated fully on-device with [Kokoro TTS](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)
  (via `kokoro-js`/transformers.js) — no server, no API key, works offline
  after the first load.
- Bundled, curated word list + definitions and a names list — no internet
  lookups, so content stays kid-appropriate and the app works offline.
- A jumble/anagram solver suggests real words hiding in whatever was typed.
- A "Simple Mode" toggle swaps the full A–Z keyboard for a 14-letter set
  covering the most common short words, with bigger tiles — for younger
  toddlers.
- Installable as a PWA (works offline, add to home screen).

## Requirements

- [Node.js](https://nodejs.org/) 18+

## Getting started

```bash
git clone <this-repo-url>
cd spelling-app
npm install
npm run dev
```

Then open the URL Vite prints (defaults to `http://localhost:5757`).

The first time you pick a narrator voice or spell a word, the app downloads
the Kokoro voice model (~90MB) — after that it's cached in the browser and
loads instantly.

## Building for production

```bash
npm run build
npm run preview
```

`npm run build` outputs a static site in `dist/` that can be hosted anywhere
(GitHub Pages, Netlify, Vercel, a plain static file server, etc.) — no
backend required.

## Project structure

```
index.html          Entry HTML
src/app.js           App logic (input, dictionary lookup, jumble solver, UI)
src/tts.js           Kokoro TTS wrapper (voice loading, caching, playback)
src/style.css        Styling
public/data/         Bundled word list (with definitions) and names list
public/manifest.json PWA manifest
```

## Notes

- Voices are picked from Kokoro's own quality-graded voice set (only B- or
  better) for clearer speech.
- Audio is played via the Web Audio API (not the `<audio>` tag) for reliable
  playback across browsers, including Safari.
