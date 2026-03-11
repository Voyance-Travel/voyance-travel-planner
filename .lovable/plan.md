

## Fix 16: Replace Lovable Favicon with Voyance Favicon

### Changes

**1. Update `index.html` favicon section** (lines ~46-48)

Replace the current favicon links with explicit size declarations and bump cache-buster to `?v=3`:

```html
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=3">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon.png?v=3">
<link rel="icon" type="image/x-icon" href="/favicon.png?v=3">
<link rel="apple-touch-icon" href="/favicon.png?v=3">
```

**2. Delete `public/favicon.ico`**

Remove the leftover Lovable heart icon so Google's default `/favicon.ico` lookup returns 404 instead of the wrong logo.

### Post-Deploy

Request Google re-crawl via Search Console for both the homepage and `/favicon.ico`. Favicon updates typically take 1-2 weeks.

