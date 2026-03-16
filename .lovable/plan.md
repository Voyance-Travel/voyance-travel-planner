

# Add Founder's Guide: Las Vegas

## What
Add Las Vegas as the sixth Founder's Guide entry in `src/data/founders-guides.ts`.

## How
Append a new object to the `foundersGuides` array with:
- `slug: 'las-vegas'`, `destination: 'Las Vegas'`, `readTime: '5 min read'`
- `tags: ['Las Vegas', 'Food', 'Hotels', 'Nightlife', 'Nevada']`
- `coverImage`: Unsplash photo via `toSiteImageUrlFromPhotoId('photo-1605833556294-ea5c7a74f57d')` (Las Vegas Strip)
- `subtitle`: "The right hotel, the right meals, and the hidden spots most visitors miss."
- Full markdown content covering: Where to Stay (Wynn, Encore, Cosmopolitan), Where to Eat (La Cave, Gordon Ramsay Fish & Chips, Secret Pizza, Bellagio Patisserie), The Hack (ResortPass), The Takeaway

## Files Changed
- **Modified**: `src/data/founders-guides.ts` — add Las Vegas guide entry at end of array

