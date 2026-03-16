

# Add Founder's Guide: Atlanta

## What
Add Atlanta as the seventh Founder's Guide entry in `src/data/founders-guides.ts`.

## How
Append a new object to the `foundersGuides` array (before the closing `];` at line 372) with:
- `slug: 'atlanta'`, `destination: 'Atlanta'`, `readTime: '6 min read'`
- `tags: ['Atlanta', 'Food', 'Restaurants', 'Day Trips', 'Georgia']`
- `coverImage`: `toSiteImageUrlFromPhotoId('photo-1575917649111-0cee4e0e8b22')` (Atlanta skyline)
- `subtitle`: "A restaurant city that punches well above its weight."
- Full markdown content covering: What to See (Georgia Aquarium, World of Coca-Cola, Piedmont Park), Where to Eat (Atlas, Bacchanalia, Omakase Table, Chops Lobster Bar, Taqueria Del Sol, Barcelona Wine Bar, Little Sparrow / Bar Blanc, Marcel), Day Trip (Chateau Elan), The Takeaway

## Files Changed
- **Modified**: `src/data/founders-guides.ts` — add Atlanta guide entry at end of array

