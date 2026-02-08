# Voyance Platform Test Suite

**Pre-Launch Checklist**
Last Updated: February 2025 | Test Environment: Production / Staging

---

## How to Use This Document

1. Create a fresh test account for each full run
2. Check each item as you test
3. Note any failures with details
4. Retest after fixes

---

## Section 1: Static Pages & Navigation

### Homepage
- [ ] Page loads without errors
- [ ] Hero section displays correctly
- [ ] "Where do you want to go?" input is functional
- [ ] Navigation links work (Explore, How It Works, Pricing)
- [ ] Footer links work
- [ ] Mobile responsive
- [ ] Images load
- [ ] CTAs are clickable

### How It Works Page
- [ ] Page loads without errors
- [ ] Step 1/2/3 sections display
- [ ] Interactive demo works (toggle between types)
- [ ] Sample itinerary displays
- [ ] Group travel blending section works
- [ ] "Take the Quiz" CTA works
- [ ] Mobile responsive

### Pricing Page
- [ ] Page loads without errors
- [ ] Free tier explanation displays
- [ ] Flexible credits show: 100/$9, 300/$25, 500/$39
- [ ] Voyance Club packs show correctly:
  - [ ] Voyager: 500 + 100 bonus = 600 for $29.99
  - [ ] Explorer: 1,200 + 400 bonus = 1,600 for $59.99
  - [ ] Adventurer: 2,500 + 700 bonus = 3,200 for $99.99
- [ ] Credit examples section displays
- [ ] FAQ section works (expand/collapse)
- [ ] "Start Free" CTA works
- [ ] Mobile responsive

### About Page
- [ ] Page loads without errors
- [ ] Content displays correctly
- [ ] Transparency table shows feature status
- [ ] Mobile responsive

### Archetypes Browse Page
- [ ] Page loads without errors
- [ ] All 27 types display (not "archetypes")
- [ ] Categories show: Explorer, Connector, Achiever, Restorer, Curator, Transformer
- [ ] Click through to individual type pages works
- [ ] Mobile responsive

### Archetype Detail Page
- [ ] Page loads for each type
- [ ] Type name, tagline, description display
- [ ] Key traits display
- [ ] "How It Works" section displays
- [ ] 6 categories navigation works
- [ ] Mobile responsive

---

## Section 2: Authentication

### Sign Up
- [ ] Sign up form displays
- [ ] Email validation works
- [ ] Password requirements enforced
- [ ] Successful signup creates account
- [ ] Redirect to appropriate page after signup
- [ ] Error messages display for invalid input

### Sign In
- [ ] Sign in form displays
- [ ] Email/password authentication works
- [ ] "Forgot password" flow works
- [ ] Redirect to appropriate page after signin
- [ ] Error messages for wrong credentials

### Sign Out
- [ ] Sign out button accessible
- [ ] Sign out clears session
- [ ] Redirect to homepage after signout

---

## Section 3: Travel DNA Quiz

### Quiz Flow
- [ ] Quiz intro page displays
- [ ] "Start Quiz" begins questions
- [ ] All 21 questions load in sequence
- [ ] Progress indicator updates
- [ ] Can go back to previous questions
- [ ] Can change answers

### Quiz - "Just Tell Us" Option
- [ ] Chat alternative to quiz is accessible
- [ ] Can describe preferences in chat
- [ ] Parser extracts preferences correctly
- [ ] Results equivalent to taking full quiz

### Quiz Results
- [ ] Results page displays after completion
- [ ] Primary type assigned
- [ ] Secondary type assigned (if applicable)
- [ ] Trait scores display (8 traits)
- [ ] Type description displays
- [ ] "Plan a Trip" CTA works
- [ ] Results saved to user profile

### Quiz Value Display
- [ ] Trip preview updates as questions are answered
- [ ] Shows how answers affect itinerary
- [ ] Creates engagement during quiz

---

## Section 4: Trip Creation

### Trip Builder - Entry Points
- [ ] "Plan a Trip" accessible from multiple locations
- [ ] Single City tab works
- [ ] Multi-City tab works
- [ ] "Just Tell Us" chat tab works
- [ ] "I'll Build Myself" manual option works

### Single City Flow
- [ ] Destination input works (autocomplete)
- [ ] Date picker works
- [ ] Traveler count selector works
- [ ] Trip type selection works
- [ ] Budget selector works
- [ ] Hotel/accommodation input works
- [ ] Flight details input works (optional)
- [ ] Form validation works
- [ ] "Build My Itinerary" submits correctly

### Multi-City Flow
- [ ] Can add multiple destinations
- [ ] Can set order of cities
- [ ] Can set days per city
- [ ] Multi-city fee calculated correctly (+30 credits per additional city)
- [ ] Form submits correctly

### "Just Tell Us" Chat Flow
- [ ] Chat interface opens
- [ ] Welcome message displays
- [ ] Can type trip details
- [ ] Can paste from other sources (ChatGPT, etc.)
- [ ] Parser extracts:
  - [ ] Destination
  - [ ] Dates
  - [ ] Travelers
  - [ ] Trip type
  - [ ] Budget signals
  - [ ] Hotel/flight details
  - [ ] Must-haves / must-avoids
  - [ ] Dietary restrictions
- [ ] Confirmation shows extracted details
- [ ] Can edit extracted details before confirming
- [ ] User preferences from prompt saved (optional)

### "I'll Build Myself" Manual Flow
- [ ] Manual builder opens
- [ ] Can create days
- [ ] Can add activities manually
- [ ] Can input:
  - [ ] Activity name
  - [ ] Time
  - [ ] Address (Nominatim search works)
  - [ ] Cost
  - [ ] Notes
- [ ] Paste import works for manual trips
- [ ] Schema organizes pasted content correctly
- [ ] Either/or options from paste displayed correctly

---

## Section 5: Free User Experience

### First Trip (Free - 2 Days Full Power)
- [ ] New user gets first trip free
- [ ] 2 days generated (not more)
- [ ] All details visible:
  - [ ] Activity names
  - [ ] Times
  - [ ] Addresses
  - [ ] Costs
  - [ ] Photos
  - [ ] Ratings/reviews
  - [ ] Insider tips
  - [ ] Weather
  - [ ] Booking links
  - [ ] Transportation between stops
- [ ] 5 free edits available
- [ ] Edit counter displays
- [ ] After 5 edits, editing locks
- [ ] Day 3+ shows as locked
- [ ] Unlock prompt displays for Day 3+

### Subsequent Trips (After First Free Trip)
- [ ] free_trip_used flag is true
- [ ] New trips show Day 1 only
- [ ] Day 1 is generic preview (not enriched):
  - [ ] Activity names visible
  - [ ] Times visible
  - [ ] Addresses locked
  - [ ] Costs locked
  - [ ] Photos locked
  - [ ] Tips locked
  - [ ] Reviews locked
- [ ] Unlock prompt for full trip

### Monthly Free Credits (150)
- [ ] New users receive 150 credits
- [ ] Credit balance displays correctly
- [ ] Credits refresh monthly
- [ ] Credits expire after 2 months
- [ ] Expired credits removed from balance

---

## Section 6: Credit System

### Credit Display
- [ ] Credit balance visible in header/account
- [ ] Balance updates after purchases
- [ ] Balance updates after credit usage
- [ ] Low balance warning at ~50 credits
- [ ] Out of credits message when empty

### Flexible Credit Purchase
- [ ] 100 credits / $9 option works
- [ ] 300 credits / $25 option works
- [ ] 500 credits / $39 option works
- [ ] Stripe checkout opens
- [ ] Payment processes successfully
- [ ] Credits added to account immediately
- [ ] Receipt/confirmation displayed
- [ ] Flexible credits have 12-month expiration

### Voyance Club Pack Purchase
- [ ] Voyager ($29.99) shows 500 + 100 bonus = 600
- [ ] Explorer ($59.99) shows 1,200 + 400 bonus = 1,600
- [ ] Adventurer ($99.99) shows 2,500 + 700 bonus = 3,200
- [ ] Pack perks display correctly
- [ ] Stripe checkout opens
- [ ] Payment processes successfully
- [ ] Base credits added (never expire with annual login)
- [ ] Bonus credits added (6-month expiration)
- [ ] Club badge assigned to profile
- [ ] Founding Member badge for Adventurer (if within first 1,000)
- [ ] Founding Member counter updates

### Credit Consumption
- [ ] Unlocking days deducts credits (60/day)
- [ ] Multi-city fee deducts correctly (+30/city)
- [ ] Complexity multiplier applied where relevant
- [ ] User sees credit cost before unlock
- [ ] Credits deducted only after confirmation

---

## Section 7: Itinerary Features

### Itinerary Display
- [ ] Days display in order
- [ ] Activities display with correct times
- [ ] Activity cards show all relevant info
- [ ] Day themes/titles display
- [ ] Weather displays per day
- [ ] Total trip cost displays
- [ ] Expand/collapse days works

### Included Actions (Per Unlocked Trip)

#### Swaps (30 included)
- [ ] Swap button visible on activities
- [ ] Click opens alternatives
- [ ] Can select alternative
- [ ] Activity replaces correctly
- [ ] Swap count tracked
- [ ] After 30, prompt for more (5 credits per +10)

#### Regenerate Day (15 included)
- [ ] Regenerate button visible on days
- [ ] Click regenerates entire day
- [ ] New activities load
- [ ] Regenerate count tracked
- [ ] After 15, prompt for more (10 credits per +5)

#### Chat (50 messages included)
- [ ] Chat accessible from itinerary
- [ ] Can ask questions about trip
- [ ] Responses are contextual
- [ ] Message count tracked
- [ ] After 50, prompt for more (5 credits per +20)

#### Restaurant Discovery (10 included)
- [ ] Can search for restaurants
- [ ] Results display correctly
- [ ] Can add to itinerary
- [ ] Discovery count tracked
- [ ] After 10, prompt for more (5 credits per +5)

#### Nearby Suggestions (Unlimited)
- [ ] Nearby suggestions appear
- [ ] Can view details
- [ ] Can add to itinerary
- [ ] No limit enforced

#### Route Optimization (Unlimited)
- [ ] Optimize route button works
- [ ] Reorders activities efficiently
- [ ] Shows time/distance savings
- [ ] No limit enforced

#### Local Events (Unlimited)
- [ ] Events for dates display
- [ ] Can view event details
- [ ] Can add to itinerary
- [ ] No limit enforced

### Other Itinerary Features
- [ ] Lock activity works (prevents swap/removal)
- [ ] Unlock activity works
- [ ] Reorder activities (drag and drop)
- [ ] Remove activity works
- [ ] Add custom activity works
- [ ] Booking links open correctly
- [ ] "Booking required" badges display
- [ ] Viator integration works

### PDF Export
- [ ] Export button visible (for paid/unlocked trips)
- [ ] PDF generates correctly
- [ ] PDF includes all trip details
- [ ] PDF blocked for free manual users

---

## Section 8: Smart Finish ($6.99)

### Gap Analysis (Free Teaser)
- [ ] Auto-triggers for manual/imported trips
- [ ] Shows gap count ("5 gaps detected")
- [ ] Shows gap hints (not full details)
- [ ] Gap types detected:
  - [ ] Pace mismatch
  - [ ] Missing preferences
  - [ ] Timing issues
  - [ ] Budget drift
  - [ ] Missing meals
  - [ ] Weather conflicts
- [ ] Smart Finish CTA displays

### Smart Finish Purchase
- [ ] $6.99 price displays
- [ ] Stripe checkout opens
- [ ] Payment processes successfully
- [ ] smart_finish_purchased flag set on trip

### Smart Finish Enrichment (Post-Purchase)
- [ ] Route optimization applied
- [ ] Reviews attached to activities
- [ ] Insider tips added
- [ ] Weather integrated
- [ ] DNA gap detailed fixes provided
- [ ] Local events added
- [ ] Nearby suggestions added
- [ ] PDF export enabled
- [ ] Trip refreshes with enriched data

---

## Section 9: Collaboration & Sharing

### Share Trip
- [ ] Share button visible
- [ ] Can generate share link
- [ ] Link works for recipients
- [ ] Recipients see read-only view (or edit if permitted)

### Collaborate on Trip
- [ ] Can invite collaborators
- [ ] Collaborators can view trip
- [ ] Collaborators can edit (if permitted)
- [ ] Changes sync in real-time
- [ ] Club badge shows on shared trips

### Group Travel Blending
- [ ] Can add travel companions
- [ ] Companion's DNA considered
- [ ] Blended itinerary reflects both profiles
- [ ] Compatibility score displays

---

## Section 10: User Account

### Profile
- [ ] Profile page accessible
- [ ] Name displays
- [ ] Email displays
- [ ] Travel DNA type displays
- [ ] Club badge displays (if applicable)
- [ ] Credit balance displays
- [ ] Can edit profile information

### My Trips
- [ ] Trip history displays
- [ ] Can view past trips
- [ ] Can continue draft trips
- [ ] Can delete trips

### Preferences
- [ ] Can update travel preferences
- [ ] Dietary restrictions saved
- [ ] Accessibility needs saved
- [ ] Preferences applied to future trips

---

## Section 11: Payments (Stripe)

### Checkout Flow
- [ ] Stripe checkout loads
- [ ] Card input works
- [ ] Payment processes
- [ ] Success redirect works
- [ ] Failure handling works
- [ ] Webhook updates database

### Payment Types
- [ ] Flexible credits: one-time payment
- [ ] Club packs: one-time payment
- [ ] Smart Finish: one-time payment per trip

### Receipts
- [ ] Email receipt sent
- [ ] Receipt accessible in account

---

## Section 12: Dashboard & Analytics (Internal)

### Cost Tracking
- [ ] API calls logged
- [ ] Cost per action tracked
- [ ] Cost per user calculated
- [ ] Cost per trip calculated

### Revenue Tracking
- [ ] Purchases logged
- [ ] Revenue per user calculated
- [ ] Conversion rate calculated
- [ ] Projections update based on inputs

### User Tracking
- [ ] User signups tracked
- [ ] Quiz completions tracked
- [ ] Trips created tracked
- [ ] Trips unlocked tracked

---

## Section 13: Edge Cases & Error Handling

### Credit Edge Cases
- [ ] User tries to unlock with insufficient credits - prompt to buy
- [ ] User hits swap cap - prompt for more
- [ ] User hits regenerate cap - prompt for more
- [ ] User hits chat cap - prompt for more
- [ ] Expired credits don't count toward balance
- [ ] Mix of expiring and non-expiring credits handled correctly

### Trip Edge Cases
- [ ] Very long trip (10+ days) handled
- [ ] Multi-city (4+ cities) handled
- [ ] Complex trip (dietary + accessibility + occasion) handled
- [ ] Empty trip (no activities) handled gracefully

### User Edge Cases
- [ ] User with no Travel DNA tries to create trip - prompt quiz
- [ ] User refreshes mid-checkout - handled gracefully
- [ ] User goes back during trip creation - state preserved
- [ ] Session timeout - graceful re-auth

### Parser Edge Cases
- [ ] Messy paste input - handled gracefully
- [ ] Table format paste - parsed correctly
- [ ] Prompt + output paste - both extracted
- [ ] Non-English input - handled or flagged
- [ ] Empty paste - error message

---

## Section 14: Mobile Responsiveness

### Key Pages Mobile Test
- [ ] Homepage
- [ ] How It Works
- [ ] Pricing
- [ ] Quiz
- [ ] Trip Builder
- [ ] Itinerary View
- [ ] Profile

### Mobile-Specific
- [ ] Touch targets large enough
- [ ] No horizontal scroll
- [ ] Text readable without zoom
- [ ] Forms usable
- [ ] Modals fit screen

---

## Section 15: Performance

### Load Times
- [ ] Homepage < 3 seconds
- [ ] Itinerary generation < 10 seconds
- [ ] Activity swap < 3 seconds
- [ ] Day regeneration < 5 seconds
- [ ] Page navigation < 2 seconds

### Stress Test (Optional)
- [ ] Multiple concurrent users
- [ ] Large itinerary (10+ days)
- [ ] Rapid action clicks

---

## Section 16: Terminology Consistency

### Verify These Terms Throughout
- [ ] "Type" (not "archetype" or "personality")
- [ ] "Travel DNA" (the system)
- [ ] "Category" (Explorer, Connector, etc.)
- [ ] 27 types (not 27 archetypes)
- [ ] "Voyance Club" for packs
- [ ] "Smart Finish" for $6.99 enrichment

---

## Quick Smoke Test (5 Minutes)

For rapid testing after changes:

1. [ ] Homepage loads
2. [ ] Can start quiz
3. [ ] Quiz completes, type assigned
4. [ ] Can create trip
5. [ ] Itinerary generates
6. [ ] Can swap an activity
7. [ ] Credit purchase works
8. [ ] Sign out works

---

## Test Run Log

| Date | Tester | Result | Notes |
|------|--------|--------|-------|
|      |        |        |       |

---

## Known Issues (Track Here)

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
|       |          |        |       |
