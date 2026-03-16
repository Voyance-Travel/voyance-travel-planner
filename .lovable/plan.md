

# How It Works Page Updates

## Summary
Update copy and badges for sections 04 and 05, add two new sections (Watch Your Budget as new 04, We Only Know Travel-You as new 07), add 3 new promise bullets, and renumber all steps accordingly.

## Changes

### File: `src/pages/HowItWorks.tsx`

**1. Add new icons to imports**
- Add `Compass`, `Wallet`, `Brain` (or similar) icons for the new sections and promise bullets.

**2. Update `promises` array (line 46-51)**
Add 3 new items:
- "We learn travel-you, nothing else" (Dna icon)
- "Your trips are saved forever" (BookOpen icon)  
- "Every rating makes your next trip better" (Star icon — reuse existing)

**3. Insert new Chapter 04 "Watch your budget" after Chapter 03 (after line 354)**
- New `motion.div` with alternating layout (image right, text left since previous chapter has image right — this follows the odd/even pattern)
- Number: `04`, title: "Watch your budget"
- Copy as provided in the prompt
- Badges: "Real-time / totals", "Per-day / breakdown", "No surprises / guaranteed"
- Image: Use an existing or placeholder budget-themed image (reuse `itineraryImage` or import a new one)

**4. Renumber Chapter 04 → 05 "Live your trip" (line 372)**
- Change `04` to `05`
- Replace description text (line 376-379) with the new copy mentioning live map view
- Update badges to: "Live map / see your full trip", "Real-time / guidance", "On-the-fly / changes"

**5. Renumber Chapter 05 → 06 "Share your story" (line 406)**
- Change `05` to `06`
- Replace description text (lines 410-413) with new copy about past trips, ratings learning
- Update badges to: "Past trips / saved forever", "Community / guides", "Your ratings / make us smarter"

**6. Insert new Chapter 07 "We only know travel-you" after Share Your Story (after line 438)**
- New `motion.div` with alternating layout (image left, text right)
- Number: `07`
- Copy as provided in the prompt
- Badges: "Travel-only / DNA", "Tell us once / we remember", "Always / improving"
- Image: Reuse `quizImage` or similar travel-themed image

### File: `src/components/home/HowItWorksSideNav.tsx`
- No structural changes needed — the side nav uses section IDs and all new content is within the existing `#journey` section, so it will be covered by "The Journey" nav item.

### New image needs
- For "Watch your budget" section, will need a budget-themed image. Options: generate a new placeholder or reuse an existing asset like `itineraryImage`. Will reuse an existing image to avoid blocking on asset creation.
- For "We only know travel-you" section, will reuse `quizImage` or `planImage` as a travel-themed stand-in.

## Final page flow after changes
01 Tell us who you are → 02 Start your way → 03 Get your itinerary → **04 Watch your budget (NEW)** → **05 Live your trip (UPDATED)** → **06 Share your story (UPDATED)** → **07 We only know travel-you (NEW)** → Travel DNA → Personalization → Group Travel → Playground → **Our Promise (UPDATED)** → CTA

