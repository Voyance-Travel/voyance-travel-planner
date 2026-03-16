

# Founder's Guides: London (First Guide + Infrastructure)

## What We're Building

1. **New "Founder's Guides" data structure** — static data file (`src/data/founders-guides.ts`) with the London guide content, using the same `Guide` interface pattern as `src/data/guides.ts` but with a `founder` author field and richer long-form content.

2. **New route `/founders-guides/:slug`** — a dedicated detail page with a more personal, editorial feel (author byline "By Ashton Lightfoot, Co-Founder of Voyance", no category chips, warm tone).

3. **Founder's Guides tab on `/guides`** — add a third tab alongside "Voyance Guides" and "Community" in the existing `Tabs` component on the Guides page.

4. **"Find out what we love" CTA on About page** — insert a new block after the "Who's Behind It" section (after line 473) linking to `/founders-guides` or the guides page with a `?tab=founders` param.

5. **Founder's Guides section on Explore page** — optional row in `VoyanceGuides.tsx` similar to the Community Guides row.

## Technical Approach

### Data: `src/data/founders-guides.ts`
- Export a `FoundersGuide` interface extending the existing `Guide` interface with `authorTitle` and `authorName` fields.
- The London guide as the first entry with full markdown content (the text provided by the user).
- Helper functions: `getFoundersGuides()`, `getFoundersGuideBySlug()`.

### New Page: `src/pages/FoundersGuideDetail.tsx`
- Reuse the same `parseContent()` markdown renderer from `GuideDetail.tsx` (extract to shared util or copy).
- Personal author header with name, title, and a warmer design.
- Route: `/founders-guides/:slug` added to `App.tsx`.

### Guides Page Update: `src/pages/Guides.tsx`
- Add a third `TabsTrigger` for "Founder's" with a `Heart` or `Star` icon.
- New `TabsContent` rendering founder's guide cards linking to `/founders-guides/:slug`.
- Support `?tab=founders` URL param.

### About Page CTA: `src/pages/About.tsx`
- Insert after the "Who's Behind It" section (after line 473, before "Company Credibility Block").
- Simple block: "Find out what we love" heading with a brief line and a button/link to `/guides?tab=founders`.

### Content Structure (London Guide)
The guide will be stored as markdown in the `content` field with these sections:
- Getting In (Heathrow Express)
- What to See (Trafalgar Square, British Museum)
- Where to Eat (Gordon's Wine Bar, Noble Rot, Flat Iron, Fatt Pundit, Yauatcha, Sushi Kyu, Laduree)
- Nightlife (Ronnie Scott's)
- Markets (Borough Market)
- The Takeaway

## Files Changed
- **New**: `src/data/founders-guides.ts` — guide data + helpers
- **New**: `src/pages/FoundersGuideDetail.tsx` — detail page
- **Modified**: `src/App.tsx` — add route
- **Modified**: `src/pages/Guides.tsx` — add Founder's tab
- **Modified**: `src/pages/About.tsx` — add CTA after Who's Behind It
- **Modified**: `src/components/explore/sections/VoyanceGuides.tsx` — optional Founder's Guides row

