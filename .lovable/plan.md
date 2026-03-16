

# Format for Adding Voyance Picks Data

Based on the `voyance_picks` table schema, here's the exact format you need to add new owner's recommendations:

## SQL INSERT Format

```sql
INSERT INTO voyance_picks (
  destination,
  name,
  category,
  why_essential,
  description,
  insider_tip,
  neighborhood,
  price_range,
  best_time,
  address,
  tags,
  priority
) VALUES (
  'New York',                                    -- destination (required) - city name
  'The Spotted Pig',                             -- name (required) - venue name
  'dining',                                      -- category (required) - dining, nightlife, activity, experience
  'Legendary gastropub that defined West Village dining',  -- why_essential (required) - short reason
  'Michelin-starred gastropub serving elevated comfort food in a cozy, no-reservations setting',  -- description
  'Arrive by 5:30pm on weekdays or expect a 90+ minute wait. The ricotta gnudi and chargrilled burger are non-negotiable.',  -- insider_tip
  'West Village',                                -- neighborhood
  '$30-50',                                      -- price_range
  'Weekday early dinner (5:30-6pm) to avoid the crowd',  -- best_time
  '314 W 11th St, New York, NY 10014',          -- address
  ARRAY['gastropub', 'michelin-star', 'no-reservations', 'local-favorite'],  -- tags (array)
  1                                              -- priority (1 = highest)
);
```

## Field Requirements

**Required Fields:**
- `destination` - City name (e.g., "New York", "Paris", "Tokyo")
- `name` - Venue/experience name
- `category` - One of: `dining`, `nightlife`, `activity`, `experience`, `accommodation`
- `why_essential` - Short reason why this is a founder pick (1-2 sentences)

**Recommended Fields:**
- `description` - What it is and what makes it special
- `insider_tip` - Specific actionable advice (timing, what to order, how to experience it)
- `neighborhood` - Area/district within the city
- `price_range` - Format like "$15-25", "$$", "$50-100 per person"
- `best_time` - When to go for best experience
- `tags` - Array of relevant tags

**Optional Fields:**
- `address` - Full street address
- `coordinates` - JSON with lat/lng: `'{"lat": 40.7359, "lng": -74.0064}'::jsonb`
- `priority` - 1 (highest) to 10 (lowest), default is 1
- `added_by` - Defaults to "founder"
- `is_active` - Defaults to true

## Example: Adding Multiple Picks for New York

```sql
-- Restaurant Pick
INSERT INTO voyance_picks (destination, name, category, why_essential, description, insider_tip, neighborhood, price_range, best_time, tags)
VALUES (
  'New York',
  'Russ & Daughters',
  'dining',
  'The definitive NYC appetizing shop — 110 years of smoked fish perfection',
  'Fourth-generation family business serving the best bagels and lox in the city, plus caviar, rugelach, and Jewish delicacies.',
  'Order the Super Heebster bagel. Get there before 10am on weekends to avoid the line. The original Essex St location has more soul than the cafe.',
  'Lower East Side',
  '$15-30',
  'Weekday breakfast (8-9am)',
  ARRAY['bagels', 'jewish-deli', 'historic', 'breakfast', 'local-icon']
);

-- Activity Pick
INSERT INTO voyance_picks (destination, name, category, why_essential, description, insider_tip, neighborhood, price_range, best_time, tags)
VALUES (
  'New York',
  'The High Line at Sunset',
  'activity',
  'NYC's most inspired public space — a park in the sky with unbeatable golden hour views',
  'Elevated park built on historic freight rail line, stretching from the Meatpacking District to Hudson Yards.',
  'Enter at Gansevoort St and walk north. Stop at the viewing platform near 10th Ave around 7pm in summer for perfect light. Exit at 23rd St for Chelsea Market.',
  'Chelsea',
  'Free',
  'Summer evenings 6:30-8pm',
  ARRAY['park', 'free', 'sunset', 'architecture', 'must-visit']
);

-- Nightlife Pick
INSERT INTO voyance_picks (destination, name, category, why_essential, description, insider_tip, neighborhood, price_range, tags)
VALUES (
  'New York',
  'Attaboy',
  'nightlife',
  'The platonic ideal of a speakeasy — no menu, just perfect drinks tailored to your taste',
  'Unmarked bar from legendary bartenders Sam Ross and Michael McIlroy. They ask what you like and create something you'll never forget.',
  'No sign, no menu, no photos. Ring the bell at 134 Eldridge. Tell them your spirit preference and one flavor you like. Trust the process. Cash only.',
  'Lower East Side',
  '$18-22 per cocktail',
  ARRAY['speakeasy', 'cocktails', 'no-menu', 'cash-only', 'intimate']
);
```

## Current Example in Database

Here's the existing Aruba pick as reference:

- **Destination:** Aruba
- **Name:** Zeerovers
- **Category:** dining
- **Why Essential:** "This IS the Aruba dining experience. No tablecloths, no reservations, no pretense — just the best seafood on the island at honest prices. Every local will tell you this is their #1 spot. Missing Zeerovers is like going to Naples and skipping pizza."
- **Description:** "A no-frills seaside fish shack in Savaneta where locals and visitors alike line up for the freshest catch on the island — fried whole fish, shrimp, and mahi mahi served on paper plates with panoramic ocean views."
- **Insider Tip:** "Go between 12-1pm before the lunch rush. Order the catch of the day fried whole with funchi and pan bati on the side. Grab a Balashi beer from the cooler. Sit at the water's edge tables — the ones on the left side have the best breeze and sunset angle."
- **Price Range:** $15-25 per person
- **Best Time:** Lunch (11:30am-2pm) for best selection, or sunset for atmosphere

## How the System Uses This Data

When generating an itinerary for the destination city, the system:
1. Queries all active Voyance Picks for that city
2. Injects them into the AI prompt with priority weighting
3. Displays matched activities with the "Voyance Pick — Vetted by our founders" badge
4. Shows the `insider_tip` in the callout component

