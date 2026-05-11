# Eliminate Render-Blocking Resources

Lighthouse flags ~530ms render-blocking. Root cause: Google Fonts loaded via `@import` at the top of `src/index.css`. That import is the worst possible pattern — the browser must download + parse the entry CSS bundle before it even discovers the font request, then block on the font CSS too.

## 1. Move Google Fonts out of `src/index.css`

Delete the `@import url('https://fonts.googleapis.com/css2?...')` line from `src/index.css` (line 1).

Add to `index.html` `<head>` after the existing preconnects, using async-stylesheet pattern so it doesn't block first paint:

```html
<link
  rel="preload"
  as="style"
  href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
/>
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
  media="print"
  onload="this.media='all'"
/>
<noscript>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" />
</noscript>
```

`display=swap` is already in the URL, so text will render immediately in the system fallback and re-flow when fonts arrive.

## 2. Vite asset hashing — confirm only

Vite already emits hashed filenames by default (`assets/[name]-[hash].js|.css`). No config change needed; will verify by inspecting `dist/assets/` after build. Skip writing `assetFileNames`/`chunkFileNames`/`entryFileNames` overrides — they would only match the existing defaults.

## 3. Cache headers — platform note

Lovable's hosting layer sets `Cache-Control` automatically: hashed `/assets/*` get long-lived immutable caching, `index.html` is no-cache. There's no per-path config we can ship from the repo. We'll note this in memory and rely on the Step 1 + previous lazy-loading work for first-visit gains.

Note: `index.html` currently has `<meta http-equiv="Cache-Control" content="no-cache">` etc. — leave as-is (defensive against the doc itself being cached).

## 4. Verification

- After deploy, re-run Lighthouse on `/`. "Render blocking requests" entry should drop the Google Fonts CSS line; total savings flagged should fall from ~530ms to <100ms.
- Visual check on landing page: headings (Playfair Display) and body (DM Sans) still render correctly after a brief system-font flash.

## Out of scope

- No font self-hosting (would shave another 50-100ms but adds licensing/maintenance overhead — separate task).
- No Tailwind purge tuning (JIT already trims).
- No new preload tags for woff2 files (Google serves them dynamically, so the URLs aren't stable enough to preload directly).
