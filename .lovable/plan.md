

# Align Feature Tour with Actual Itinerary UX

## The Problem

The `DemoFeatureShowcase` on the How It Works page shows 7 mock feature visuals that don't match what users actually see in the itinerary. The gap creates a bait-and-switch feeling:

| Feature Tour Shows | Actual Itinerary Has |
|---|---|
| Simple 2-card lock/swap with basic styling | Editorial magazine-style cards with serif typography, time-of-day sections, thumbnails, Voyance Tips, cost badges, transit badges |
| Basic budget bar chart | Full Command Center with trip total, currency toggle, credit tracking |
| Generic route timeline | Transit mode picker, inline route details, map navigation |
| Weather forecast strip + packing list | Weather integrated into Trip Details tab, no standalone packing widget |
| Simple generation steps animation | Progressive generation with day-by-day streaming |
| Missing entirely | AI chatbot assistant, Trip Health score, collaborative editing/proposals, Edit vs Preview mode toggle |

The tour also doesn't reflect the editorial design language (Playfair Display serif, gradient dividers, pull-quote tips, timeline connectors).

## Plan

### Update `src/components/demo/DemoFeatureShowcase.tsx`

**Restructure the 7 features to match what users actually experience:**

1. **Your Travel Profile** (quiz) — keep as-is, this matches
2. **Travel Together** (group) — keep as-is, this matches  
3. **AI-Curated Itinerary** (generate) — update visual to show editorial-style day card with serif fonts, time sections (Morning/Afternoon), activity cards with thumbnails, Voyance Tips pull-quotes, and cost badges. Match the actual `EditorialItinerary` aesthetic.
4. **Your Trip Command Center** (replaces "budget") — show the actual command center layout: trip total + currency toggle + action row (Share, Optimize, Export) + Health Score badge. Update description to reflect the full dashboard.
5. **Customize Any Activity** (replaces "lock & swap") — redesign visual to match editorial activity cards: time column, category icon, thumbnail, description, Voyance Tip in italic pull-quote, lock/swap/menu actions. Show the ⋯ menu with actual options (swap, move, edit, remove).
6. **AI Trip Assistant** (replaces "weather") — new visual showing the chat bubble + conversation example ("Make Day 3 more relaxed" → AI suggests changes → approve/reject). This is a core feature completely missing from the tour.
7. **Smart Routing & Transit** (optimize) — update to show transit badges between activities (walk 8 min, metro 15 min) matching `TransitBadge` design, plus the inline route expansion.

**Visual style updates across all mock cards:**
- Use `font-serif` (Playfair Display) for titles to match editorial aesthetic
- Use the actual color palette: `bg-primary/10`, `text-primary` accents
- Match the actual card borders and spacing from `EditorialItinerary`

### Update descriptions and value points

Align the text copy with what actually exists — remove claims about features that work differently (e.g., "Smart Packing Suggestions" that don't exist as shown) and add claims about features that do exist (AI assistant, health score, collaborative proposals).

### Files Changed
- **`src/components/demo/DemoFeatureShowcase.tsx`** — Restructure FEATURES array, rebuild 4 of 7 visual components to match editorial itinerary aesthetic, add new AI Assistant visual, update Budget → Command Center, update Route → Transit Badges

