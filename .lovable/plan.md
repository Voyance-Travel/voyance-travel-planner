

# About Page: Remove Photos & Adjust Bios

## Changes

### 1. Remove the photo gallery strip
- Remove the entire `travelPhotos` array and the photo imports (`aboutTravel2`, `aboutTravel4`, etc.)
- Remove the "Photo Gallery Strip" `motion.div` block (lines ~486-513)

### 2. Remove Clinton's full name
- Change the heading from "Clinton Brooks, Co-Founder" to "The Other Half of Voyance, Co-Founder"
- Keep Clinton's entire bio text as-is

### 3. Hide Graham's section
- Comment out the Graham `motion.div` block (lines 575-588) so it can be restored later

### 4. Update intro text
- Change "We're Ashton and Clinton" reference to remove Clinton's name — e.g. "We're the two people behind Voyance."

**File**: `src/pages/About.tsx` — all changes in this single file.

