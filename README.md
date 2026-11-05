# Scout's Pixel Den

A static games and personal-movies site for GitHub Pages:

https://scoutholshoe19-a11y.github.io/scout-arcade-hub/

Four original browser games (Neon Snake, Brick Breaker, Merge Tiles, Sky Hopper) and a movie shelf that stores **your** video files in this browser. Nothing is uploaded.

## Run locally

```bash
python3 -m http.server 43123
```

Open http://127.0.0.1:43123/

There is no build step. Use a local server so IndexedDB and canvas games behave the way they do on GitHub Pages.

## Publish

Push this folder and serve it as the Pages root. `.nojekyll` is included so Jekyll does not rewrite the files.

## Limits

- Movie files and high scores stay in this browser profile only. They are not synced to GitHub or to another device.
- Storage size depends on the browser. A very large video can fail when IndexedDB is full. `navigator.storage.estimate` is approximate.
- Browsers may drop the shelf in private windows, or after site data is cleared. Persist permission is best-effort.
- Playback and thumbnails need a codec the browser can decode.
- Games draw on a 480×480 canvas and are scaled with CSS.

Syne, Outfit, and JetBrains Mono are included under the SIL Open Font License (`css/fonts/OFL-*.txt`).
