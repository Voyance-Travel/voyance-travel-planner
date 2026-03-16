

## Add Help Cheat Sheet to Image Curation Page

### What Each Action Currently Does

Here's the breakdown of every action on the page today — this is what the cheat sheet will explain:

| Action | Icon | What It Does |
|--------|------|-------------|
| **Preview** | Expand icon | Opens a full-size view of the image. Free, no side effects. |
| **Replace URL** | Swap icon | Lets you paste a new URL to swap the image link in the database. The old URL is overwritten. Use when you find a better image online. |
| **Upload Replace** | Upload icon | Same as Replace, but you upload a file from your computer instead of pasting a URL. The file goes to your own storage bucket — permanent and free to serve. |
| **Blacklist** | Ban icon | Hides the image from the platform permanently. It stays in the database (marked `is_blacklisted = true`) but never shows to users again. Use for bad, irrelevant, or broken images. |
| **Upload Image** (top bar) | Plus icon | Adds a brand-new image to the library. You pick the entity name, type, and destination. |
| **Sort: Unreviewed** | Sort dropdown | Shows images with the fewest votes first — these are the ones nobody has looked at yet. |
| **Broken Only** | Toggle switch | Filters to images whose URLs failed to load (detected client-side as the page renders). |
| **Checkbox select** | Checkbox | Select multiple images, then bulk-blacklist them all at once. |

**Cost**: Viewing this page costs **$0**. All 9,670 images are already cached in your own storage. No external API calls happen when browsing.

### The Plan

Add a collapsible help panel at the top of the `ImageGallery` component — a small "How This Works" card that explains each action in plain language. It will:

1. Default to **collapsed** (just a small "?" or "Help" button) so it doesn't clutter the page for repeat visits
2. Expand to show a clean reference card with icon + action + one-line explanation for each tool
3. Include a "Cost" note confirming browsing is free
4. Use `localStorage` to remember if the user dismissed it

### File Changes

| File | Change |
|------|--------|
| `src/components/admin/ImageGallery.tsx` | Add a collapsible help/cheat-sheet panel between the page header and the filters bar, using existing UI primitives (Collapsible or a simple toggle with state) |

One file, purely additive UI — no logic or backend changes.

