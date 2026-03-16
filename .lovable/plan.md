

# Add Travel Photo Gallery to About Page

## What
Replace the AI-generated individual headshots with a horizontal scrolling gallery of all 9 uploaded real photos at the top of "The People Behind Voyance" section. Remove the individual photo containers from each bio card, keeping just the text bios.

## How

### 1. Copy all 9 uploaded photos to `src/assets/`
- `about-travel-1.jpg` through `about-travel-9.jpg` (Brooklyn Bridge, Sunset, Pike Place, Rome, Drinks, Christmas/Graham, Big Ben, Hot Air Balloon, Disney)

### 2. Update `src/pages/About.tsx`
- Add imports for all 9 photos
- Remove imports for `ashtonHeadshot`, `clintonHeadshot`, `grahamHeadshot`
- After the intro text and before the Ashton bio, add a horizontal scrolling photo strip:
  - `overflow-x-auto` container with `flex gap-4`
  - Each photo in a protected container (same pattern: `onContextMenu` prevent, `pointer-events-none select-none`, `draggable={false}`, transparent overlay div)
  - Photos sized ~280px wide, aspect-ratio maintained, rounded corners
- Remove the photo `<div>` from each of the 3 bio cards (Ashton, Clinton, Graham), keeping only the text content
- Remove the `flex-row` layout from bio cards since they'll be text-only now

### 3. Image protection (same pattern already in use)
- `pointer-events-none select-none` on `<img>`
- `draggable={false}`
- Transparent overlay `<div className="absolute inset-0" />`
- `onContextMenu={(e) => e.preventDefault()}` on container

## Files Changed
- **Created**: 9 photos copied to `src/assets/`
- **Modified**: `src/pages/About.tsx` - replace headshot imports, add gallery strip, simplify bio cards to text-only

