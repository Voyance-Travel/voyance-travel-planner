

## Fix Favicon: Replace Lovable Default with Voyance Icon

The HTML references are correct (`/favicon.png`, `/favicon.ico`), but the actual image files in `public/` are still Lovable's default icons. The previous copy attempts may not have persisted correctly.

### Plan

1. **Copy your uploaded icon to `public/favicon.png`** -- overwrite the current Lovable default with your teal V icon.

2. **Add cache-busting query strings to `index.html`** -- browsers aggressively cache favicons. Adding `?v=2` to the favicon `href` attributes will force browsers (and Google) to fetch the new file:
   ```html
   <link rel="icon" type="image/png" href="/favicon.png?v=2" />
   <link rel="icon" type="image/x-icon" href="/favicon.ico?v=2" />
   <link rel="apple-touch-icon" href="/favicon.png?v=2" />
   ```

3. **Remove the `.ico` reference** -- since you only have the PNG, having a separate `.ico` reference can cause browsers to prefer the stale `.ico`. We'll point both icon links to the PNG only, or copy the PNG as the `.ico` as well.

This ensures the file is actually your icon AND that browsers stop serving the cached Lovable version.

