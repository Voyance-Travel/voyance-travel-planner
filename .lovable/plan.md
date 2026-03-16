

# Update About Page: "The People Behind Voyance" Section + I→We Language

## Changes

### 1. Fix "I" → "We" language (lines 383-393)
In the "Why Voyance Exists" section, update three paragraphs:
- "I kept having" → "we kept having"
- "I'd spend hours" → "We'd spend hours"  
- "I wanted" → "We wanted"

### 2. Replace "Who's Behind It" section (lines 443-473)
Replace the current short generic section with a full "The People Behind Voyance" section containing:

- **Intro text**: The provided copy about not being a big tech company, the origin story, and the Voyance Pick promise
- **Ashton Lightfoot, Co-Founder**: Photo + bio (product, Georgia Tech MBA, travel passion)
- **Clinton Brooks, Co-Founder**: Photo + bio (finance, travel partner, business strategy)
- **Graham, Chief Inspiration Officer**: Photo + bio (the Yorkie)

Each person card will include a protected image (no right-click save, no drag, CSS `pointer-events: none` + `user-select: none` on the image, with an invisible overlay div to block interaction) and their bio text.

### 3. Image protection approach
- Wrap each photo in a container with `relative overflow-hidden`
- Apply `pointer-events-none select-none` and `draggable={false}` on the `<img>`
- Add a transparent overlay `<div>` on top to block right-click/copy
- Add `onContextMenu={(e) => e.preventDefault()}` on the container

### 4. Images
Will use `imagegen` to generate placeholder/stylized photos for Ashton, Clinton, and Graham, stored in `src/assets/`.

## Files Changed
- **Modified**: `src/pages/About.tsx` - Update "Why Voyance Exists" text (I→We), replace "Who's Behind It" with expanded "The People Behind Voyance" section with 3 protected photo+bio cards

