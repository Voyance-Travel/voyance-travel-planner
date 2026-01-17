# Voyance UX Specification

> Complete User Experience Spec for Voyance - the anti-influencer, research-driven travel platform

---

## SECTION 1: What Voyance Is (Product Definition)

### One-Paragraph Definition
Voyance is a next-generation travel planning and booking platform built on deep research, lived experience signals, and transparent curation. It explicitly rejects influencer-driven travel content in favor of time-optimized, cost-effective, and honestly-curated recommendations. Every suggestion includes timing intelligence, crowd predictions, and clear rationale—empowering travelers to make confident decisions without manipulation.

### Target Customers & Jobs To Be Done
- **Time-constrained professionals**: "Help me maximize a 3-day trip without wasted hours"
- **First-time city visitors**: "Guide me through the essentials without tourist traps"
- **Group trip coordinators**: "Build consensus and handle logistics for multiple travelers"
- **Research-oriented planners**: "Give me the 'why' behind every recommendation"

### Non-Negotiable Product Principles
1. **Anti-influencer**: No sponsored rankings, no pay-to-play placements, no hype language
2. **Transparency**: Every recommendation explains WHY (timing data, crowd patterns, value analysis)
3. **Time/Value optimization**: Routes optimized for efficiency, not ad revenue
4. **Honest uncertainty**: Acknowledge when data is limited or variable

### What Voyance is NOT
- ❌ "Best hidden gems" listicles
- ❌ Influencer partnership platform
- ❌ Pay-to-rank vendor marketplace
- ❌ Generic aggregator with no curation logic
- ❌ FOMO-driven booking pressure tactics

### Value Proposition (3 Bullets)
1. **Save time**: AI-optimized sequencing eliminates wasted transit and poor timing
2. **Save money**: Avoid peak-pricing traps and overpriced "must-dos"
3. **Travel with confidence**: Every recommendation backed by data, not hype

---

## SECTION 2: Personas + Intent Modes

### Persona 1: The Weekend Optimizer
**Profile**: Professional with limited PTO, travels 2-4 times/year, values efficiency over spontaneity

**Anxieties**:
- "Will I waste half my trip in lines?"
- "Am I missing something obvious?"
- "Is this restaurant actually worth the wait?"

**Trust Triggers**:
- Seeing time-window recommendations ("Best window: 8-9am, 20min wait vs 2hr at noon")
- Clear tradeoff explanations
- No upselling pressure

**Churn Triggers**:
- Vague recommendations without timing data
- Too many options without clear guidance
- Hidden fees at checkout

**Conversion Triggers**:
- "One-click book" for optimized itinerary
- Price-lock guarantee
- Offline access for trip day

---

### Persona 2: The First-Time City Traveler
**Profile**: Visiting a major destination for first time, wants iconic experiences done RIGHT

**Anxieties**:
- "Will I fall for tourist traps?"
- "Is this the right neighborhood to stay in?"
- "What do locals actually do?"

**Trust Triggers**:
- "Tourist trap" warnings with alternatives
- Neighborhood context and "why stay here" explanations
- Honest reviews without influencer language

**Churn Triggers**:
- Generic "top 10" lists
- No explanation of WHY something is recommended
- Pressure to book before understanding

**Conversion Triggers**:
- Complete curated itinerary matching their pace
- "First-timer's path" vs "return visitor" differentiation
- Pre-trip checklist with everything they need

---

### Persona 3: The Group Coordinator
**Profile**: Planning trips for family/friends, managing different preferences and budgets

**Anxieties**:
- "How do I balance everyone's interests?"
- "Will budget differences cause conflict?"
- "Who's responsible for what bookings?"

**Trust Triggers**:
- Multi-traveler preference merging
- Budget transparency per person
- Clear booking ownership and sharing

**Churn Triggers**:
- No group features
- Single-payer-only checkout
- No way to share/collaborate on planning

**Conversion Triggers**:
- Split-booking capabilities
- Companion invite with role permissions
- "Everyone approved" confirmation before booking

---

## SECTION 3: Site Map + Navigation Model

### Complete Sitemap
```
/                          → Home (Hero + Explore)
/explore                   → Browse destinations by region/style
/destinations/:city        → City Guide (neighborhoods, seasons, overview)
/destinations/:city/guide  → Deep city guide with categories
/itineraries              → Pre-built curated itineraries
/itineraries/:id          → Itinerary detail view
/plan                     → Trip Planner entry (Build a Trip)
/plan/:tripId             → Active trip planning session
/plan/:tripId/flights     → Flight selection step
/plan/:tripId/hotels      → Hotel selection step
/plan/:tripId/itinerary   → Itinerary customization
/plan/:tripId/review      → Final review before booking
/plan/:tripId/checkout    → Payment and confirmation
/trips                    → My Trips dashboard
/trips/:tripId            → Trip detail (execution mode)
/saved                    → Saved items (cities, experiences, itineraries)
/profile                  → User profile and preferences
/profile/edit             → Edit profile details
/profile/travelers        → Manage companion profiles
/profile/preferences      → Travel preferences
/settings                 → Account settings
/auth/signin              → Sign in
/auth/signup              → Sign up
/auth/forgot-password     → Password recovery
/auth/reset-password      → Password reset
/about                    → About Voyance
/how-it-works             → Product explanation
/privacy                  → Privacy policy
/terms                    → Terms of service
```

### Top-Level Navigation
```
Desktop Nav:
[Logo] [Explore ▼] [Plan a Trip] [My Trips] -------- [Search 🔍] [👤 Profile]

Mobile Nav:
[☰ Menu] [Logo] [🔍] [👤]
```

### Persistent Controls (Always Accessible)
1. **Global Search**: Destinations, experiences, saved items
2. **City Switcher**: When in city context, easy switch to another
3. **My Trips Badge**: Shows active/upcoming trip count
4. **Quick Actions**: Save, share, help

### Navigation Logic
- **Browsing → Planning**: Any experience card has "Add to Trip" action
- **Planning → Booking**: Linear flow with clear step indicator
- **Dashboard → Execution**: Trip cards open to "Today View" when trip is active
- **Anywhere → Saved**: Heart icon saves to list, accessible from nav

---

## SECTION 4: Core Experience Loop

### The Main Loop (Plain Language)

```
1. DISCOVER
   └→ User finds a city/trip idea through browsing or search
   
2. UNDERSTAND
   └→ See curated options with timing intelligence and value clarity
   └→ Understand WHY each option is recommended (not just WHAT)
   
3. BUILD
   └→ Create or customize a day-by-day itinerary
   └→ See optimized sequencing with transit buffers
   └→ Lock in "must-dos" and let AI fill gaps
   
4. BOOK
   └→ Book confidently with transparent pricing
   └→ Or export plan without booking (still valuable)
   └→ Receive confirmation with offline access
   
5. EXECUTE
   └→ Day-of guidance with timing updates
   └→ Live adjustments for delays or changes
   └→ Easy access to tickets, addresses, reservations
   
6. REFLECT
   └→ Post-trip feedback improves future recommendations
   └→ Share experience (optional, non-influencer style)
   └→ Saved preferences inform next trip
```

---

## SECTION 5: Detailed Flows

### A) Entry + First Session (Guest Experience)

#### Landing Page Goals
1. Establish trust immediately (no hype, clear value prop)
2. Demonstrate value in under 60 seconds
3. Low-friction path to first useful action

#### Guest vs Gated Actions
| Action | Guest | Signed In |
|--------|-------|-----------|
| Browse destinations | ✅ | ✅ |
| View city guides | ✅ | ✅ |
| See pre-built itineraries | ✅ | ✅ |
| Generate preview itinerary | ✅ | ✅ |
| Save items | ❌ (prompt) | ✅ |
| Build full trip | ❌ (prompt) | ✅ |
| Book anything | ❌ (require) | ✅ |

#### "Value in 60 Seconds" Moment
**What user sees first**:
```
[Hero Image: Clean city photography, no stock model]

"Plan trips that respect your time."
No hype. No tourist traps. Just research-backed recommendations.

[Start Planning] or [Explore Destinations]

↓ Scroll ↓

"See how it works"
[3-step visual: Discover → Plan → Book]
```

**Friction Reduction Strategies**:
- No mandatory sign-up to browse
- Preview itinerary generation without account
- Progressive disclosure (don't overwhelm with options)

**Trust Messages** (visible on first session):
- "No sponsored rankings"
- "Every recommendation explains why"
- "Timing data from 2M+ visits analyzed"

---

### B) Sign-up / Sign-in Flow

#### Sign-up Options
1. **Email + Password** (primary)
2. **Continue with Google** (OAuth)
3. **Continue with Apple** (OAuth)
4. **Passkeys** (optional, progressive enhancement)

#### Flow Steps

**Step 1: Initial Sign-up**
```
Create your Voyance account

[Continue with Google]
[Continue with Apple]

──── or ────

Email: [________________]
Password: [________________]
[Create Account]

Already have an account? Sign in
```

**Step 2: Email Verification**
- **Timing**: Required before booking, deferred for browsing/saving
- **UX**: Inline banner prompting verification, not blocking

```
📧 Check your email
We sent a verification link to alex@email.com
[Resend] [Change email]

You can continue exploring while you verify.
```

**Step 3: Profile Setup (Minimal First)**
```
Welcome to Voyance

What should we call you?
[First name: ________]

Where are you based? (for flight suggestions)
[Home city: ________ 🔍]

[Continue] or [Skip for now]
```

**Step 4: Trust Ritual (Privacy Pledge)**
```
Our promise to you:

✓ No sponsored rankings — ever
✓ We explain why we recommend things
✓ Your data stays yours (export/delete anytime)
✓ No manipulative booking pressure

[I'm ready to plan]
```

**Step 5: Optional Onboarding Questions**
```
Help us personalize (skip any)

Travel pace preference?
○ Relaxed (2-3 activities/day)
○ Moderate (4-5 activities/day)  
○ Packed (6+ activities/day)

Typical budget range?
○ Budget-conscious
○ Mid-range
○ Flexible/Premium

Any mobility considerations?
○ No limitations
○ Prefer minimal walking
○ Wheelchair accessible required

[Save preferences]
```

#### Microcopy Examples

**Errors**:
- Email taken: "This email is already registered. [Sign in instead]"
- Weak password: "Add a number or symbol for security"
- Network error: "Connection issue. Your info is saved—try again."

**Confirmation**:
- "Account created. Welcome to research-backed travel."
- "Email verified. You're all set to book."

**Password Reset**:
- "Reset link sent. Check your inbox (and spam folder)."
- "Link expired. [Request a new one]"

---

### C) Browse Flow (Exploration → Planning)

#### City Page Structure
```
/destinations/tokyo

[Hero: Tokyo skyline, seasonal photo]

Tokyo, Japan
Best times to visit: Mar-May (cherry blossoms), Oct-Nov (fall colors)
Avoid: Golden Week (late April), Obon (mid-August)

[Plan a Tokyo Trip] [Save City]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Neighborhoods
┌─────────────┬─────────────┬─────────────┐
│ Shibuya     │ Shinjuku    │ Asakusa     │
│ Modern hub  │ Nightlife   │ Traditional │
└─────────────┴─────────────┴─────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Top Experiences
[Experience cards with timing/crowd data...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Seasonal Notes
• Spring: Book cherry blossom spots 2+ weeks ahead
• Summer: Expect humidity; plan indoor activities midday
• Fall: Best temple visits early morning
• Winter: Fewer crowds, illumination events
```

#### Experience Card Requirements
Each card MUST include:
```
┌────────────────────────────────────────┐
│ [Image]                                │
│                                        │
│ teamLab Borderless                     │
│ Digital art museum • Odaiba           │
│                                        │
│ ⏰ Best window: Weekdays 10-11am      │
│ 👥 Crowd level: Moderate (weekdays)   │
│ 💰 ¥3,200 (~$22)                       │
│                                        │
│ Why we recommend it:                   │
│ "Unique immersive experience.          │
│  Timed entry reduces wait to ~15min."  │
│                                        │
│ ⚠️ Closes permanently Feb 2025         │
│                                        │
│ [Add to Trip] [See alternatives]       │
└────────────────────────────────────────┘
```

#### Filters
```
Filter experiences:

Time of day:
[Morning] [Afternoon] [Evening] [Night]

Crowd tolerance:
[Low crowds only] [Moderate OK] [Any]

Budget per activity:
[$] [$$] [$$$] [$$$$]

Walking tolerance:
[Minimal] [Moderate] [Active explorer]

Categories:
[Food] [Culture] [Nature] [Shopping] [Nightlife]

Special:
[✓] Avoid tourist traps
[ ] Accessible venues only
[ ] Kid-friendly
```

#### "Compare Two Plans" Feature
```
Compare: Packed Day vs Relaxed Day

┌─────────────────────┬─────────────────────┐
│ PACKED (6 stops)    │ RELAXED (3 stops)   │
├─────────────────────┼─────────────────────┤
│ 8am: Tsukiji Market │ 10am: Tsukiji       │
│ 10am: teamLab       │ 1pm: Lunch + walk   │
│ 12pm: Quick lunch   │ 4pm: Senso-ji       │
│ 1pm: Senso-ji       │                     │
│ 3pm: Shibuya        │                     │
│ 6pm: Dinner         │                     │
├─────────────────────┼─────────────────────┤
│ 18,000 steps        │ 8,000 steps         │
│ ~¥15,000            │ ~¥8,000             │
└─────────────────────┴─────────────────────┘

[Use Packed] [Use Relaxed] [Customize]
```

#### Browsing → Build Trip Transition
- Any "Add to Trip" action checks for active trip
- If no active trip: "Start a new trip to Tokyo?" [Yes] [Browse more]
- If active trip exists: "Add to [Tokyo Mar 15-18] or start new?"

---

### D) Build a Trip Flow (Personalized Itinerary Builder)

#### Step-by-Step Flow

**Step 1: Trip Basics**
```
/plan

Where are you going?
[Tokyo, Japan ▼]

When?
[Mar 15, 2025] → [Mar 18, 2025]  (3 nights)

Who's traveling?
[2 adults ▼] [0 children ▼]

Departing from? (for flights)
[San Francisco, CA ▼]

[Continue to Flights →]
```

**Step 2: Flight Selection**
```
/plan/:tripId/flights

Outbound: San Francisco → Tokyo
Mar 15 • Best options ranked by value + timing

┌────────────────────────────────────────────┐
│ ★ RECOMMENDED                              │
│ JAL 1 • Departs 11:30am → Arrives 3:30pm+1│
│ Nonstop • 11h 0m                           │
│ $1,247 per person                          │
│                                            │
│ Why: "Arrives afternoon local time—        │
│  optimal for jet lag. Premium economy      │
│  available. JAL rated 4.7★ reliability."   │
│                                            │
│ [Select] [See 12 more options]             │
└────────────────────────────────────────────┘

[Skip flights—I'll book separately]
```

**Step 3: Hotel Selection**
```
/plan/:tripId/hotels

Stays in Tokyo: 3 nights (Mar 15-18)

Neighborhood recommendation:
"Shibuya: Central, walkable, good transit.
 Best for first-timers who want convenience."

┌────────────────────────────────────────────┐
│ ★ TOP MATCH                                │
│ Hotel Sequence Shibuya                     │
│ ★★★★ • Shibuya • 8 min walk to station    │
│ $185/night ($555 total)                    │
│                                            │
│ Why: "Modern, quiet rooms, highly rated    │
│  for value. Great location for your        │
│  planned activities."                      │
│                                            │
│ [Select] [Compare on map]                  │
└────────────────────────────────────────────┘

[Skip hotel—I have accommodations]
```

**Step 4: Itinerary Builder**
```
/plan/:tripId/itinerary

Your Tokyo Itinerary
3 days • Moderate pace • 2 travelers

━━━━━ Day 1: Arrival Day (Mar 15) ━━━━━

3:30pm  Arrive Narita (if flight selected)
5:00pm  Hotel check-in buffer
6:30pm  ▸ Shibuya evening walk
        Light dinner in Shibuya
        [Swap] [Remove]

Why this timing: "You'll land mid-afternoon.
Light first evening helps jet lag adjustment."

━━━━━ Day 2: East Tokyo (Mar 16) ━━━━━

8:00am  ▸ Tsukiji Outer Market
        Best window: Before 10am
        [Swap] [Remove] [🔒 Lock]
        
10:30am Transit buffer (25 min)

11:00am ▸ teamLab Borderless
        Timed entry booked
        [Swap] [Remove] [🔒 Lock]

1:00pm  Lunch break (flexible)
        [Add restaurant]

2:30pm  ▸ Senso-ji Temple + Nakamise
        Afternoon: moderate crowds
        [Swap] [Remove]

5:30pm  Return to hotel / rest

7:00pm  ▸ Dinner: Izakaya experience
        [Add reservation]

[+ Add activity]

━━━━━ Day 3: Final Day (Mar 17) ━━━━━
...
```

**Itinerary Views**
```
[Timeline] [Map] [Budget]

Timeline: Day-by-day schedule (default)
Map: Activities plotted with routes
Budget: Per-day and total breakdown
```

**Budget View Example**:
```
Trip Budget Breakdown

Flights:          $2,494 (2 × $1,247)
Hotel (3 nights): $555
Activities:       $180 (estimated)
Meals:            $300 (estimated)
Transit:          $80 (estimated)
━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:            ~$3,609

Per person:       ~$1,805
```

**Editing Behaviors**:
- **Drag/drop**: Reorder within day or across days
- **Swap**: Click to see alternatives with same time window
- **Lock**: Mark as "must do" (won't be removed by optimizer)
- **Add gap**: Insert buffer time

**Confidence Indicators**:
```
⏰ Best window: 8-10am (high confidence)
   Based on 2 years of crowd data

⏰ Variable timing
   Limited data—monitor reviews closer to date
```

**Handling Unknowns**:
```
🌧 Weather backup for Mar 16:
   If rain forecasted, we'll suggest:
   • Swap morning market → covered arcade
   • Keep teamLab (indoor)
   • Add mall/indoor options

[See rain alternatives]
```

---

### E) Booking Flow

#### Booking Options
```
Ready to book?

[Book everything] — Flights, hotel, activities in one checkout
[Book in steps] — Review and book each category separately

Booking in steps lets you:
• Use existing loyalty programs
• Apply corporate travel policies
• Book flights separately with miles
```

#### Checkout: Book Everything
```
/plan/:tripId/checkout

Review Your Booking

FLIGHTS
├ JAL 1 • Mar 15 • SFO → NRT
├ JAL 2 • Mar 18 • NRT → SFO
├ 2 passengers: Alex + Jordan
└ $2,494.00

HOTEL
├ Hotel Sequence Shibuya
├ Mar 15-18 (3 nights)
├ 1 room, 2 guests
└ $555.00 (+ $45 taxes/fees)

ACTIVITIES
├ teamLab Borderless (Mar 16, 11am)
├ 2 tickets
└ $44.00

━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal:     $3,093.00
Taxes & Fees: $45.00
━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:        $3,138.00

Cancellation policies:
• Flights: Cancel by Mar 1 for full refund
• Hotel: Free cancel until Mar 12
• teamLab: Non-refundable

[Enter payment details]
```

#### Payment Form
```
Payment

Card number: [________________]
Expiry: [__/__]  CVC: [___]

Billing address:
[Same as profile ✓]

[ ] Save card for future bookings

━━━━━━━━━━━━━━━━━━━━━━━━━━

By booking, you agree to:
• Voyance Terms of Service
• Cancellation policies above
• Vendor terms (JAL, Hotel Sequence, teamLab)

[Pay $3,138.00]
```

#### Booking Confirmation
```
✓ Booking confirmed!

Confirmation #: VYC-2025-03-15-7842

Your receipts and tickets have been sent to alex@email.com

What happens next:
1. Check your email for confirmation details
2. Your trip appears in My Trips
3. Tickets available for download 48h before
4. We'll send reminders as your trip approaches

[View My Trip] [Download receipts]
```

#### Booking Failure Handling
```
⚠️ teamLab tickets unavailable

The 11am slot sold out while you were checking out.

Available alternatives:
○ Mar 16, 2pm (+$0) — Available
○ Mar 17, 10am (+$0) — Available
○ Different attraction [Browse]

[Retry with 2pm slot] [Remove from booking]

Your flights and hotel are still held for 10 minutes.
```

#### Monetization Without Manipulation
- **No hidden fees**: All costs shown upfront
- **No fake urgency**: "Only 2 left!" never shown unless verified
- **No upsells during checkout**: Upgrades offered only on review screen
- **Commission model**: Voyance earns from bookings, not ads
- **Export option**: Users can take their itinerary elsewhere

---

### F) My Trips Dashboard

#### Dashboard Structure
```
/trips

My Trips

[Upcoming] [Past] [Drafts]

━━━━━ UPCOMING ━━━━━

┌────────────────────────────────────────┐
│ 🗼 Tokyo Adventure                     │
│ Mar 15-18, 2025 • 3 days              │
│ 2 travelers                            │
│                                        │
│ Flight: Confirmed ✓                    │
│ Hotel: Confirmed ✓                     │
│ Activities: 2 booked, 1 pending        │
│                                        │
│ [Open trip] [Share with companion]     │
└────────────────────────────────────────┘

━━━━━ DRAFTS ━━━━━

┌────────────────────────────────────────┐
│ 🏖 Barcelona (draft)                   │
│ No dates set • Planning                │
│ [Continue planning]                    │
└────────────────────────────────────────┘
```

#### Active Trip: Today View
```
/trips/:tripId (when trip is active)

Good morning, Alex! ☀️
Day 2 in Tokyo • Mar 16

━━━━━ TODAY'S PLAN ━━━━━

✓ 8:00am  Tsukiji Market
          Done

▶ 11:00am teamLab Borderless
          NEXT UP • Entry in 45 min
          
          📍 1-3-8 Aomi, Koto City
          🎫 Tap to show tickets
          🚇 25 min from current location
          
          [Get directions] [Show tickets]

○ 1:00pm  Lunch break
          Flexible • Suggestions nearby

○ 2:30pm  Senso-ji Temple
          [View details]

━━━━━ UPDATES ━━━━━

⚠️ Senso-ji expected crowded today
   Consider arriving 30 min early
   [Adjust timing]

━━━━━ QUICK ACCESS ━━━━━

[All tickets] [Reservations] [Emergency contacts]
```

#### Live Adjustments
```
🚨 Delay detected

The Yamanote Line has a 15-minute delay.

Your 11am teamLab entry may be affected.

Options:
○ Leave now (allow extra buffer)
○ Push teamLab to 11:30am slot (if available)
○ Take taxi (~¥2,500)

[Check new slot] [Get taxi directions]
```

#### Checklists
```
Pre-trip checklist:

Documents:
✓ Passport (valid 6+ months)
✓ Flight confirmation
✓ Hotel confirmation
○ Japan Rail Pass (if purchased)

To download before departure:
○ Offline map of Tokyo
○ teamLab e-tickets
○ Restaurant reservation confirmations

Don't forget:
○ Power adapter (Type A)
○ Cash (~¥30,000 for small vendors)
○ Transit IC card (buy at airport)

[Mark all complete]
```

#### Sharing & Companions
```
Trip sharing

Share "Tokyo Adventure" with companions

[Copy link] [Email invite]

Companions:
┌────────────────────────────────────┐
│ Jordan (jordan@email.com)          │
│ Role: Full access                  │
│ Can: View, edit, book              │
│ [Change permissions ▼]             │
└────────────────────────────────────┘

[+ Invite companion]

Permissions:
• View only — See itinerary
• Can edit — Modify plans
• Full access — Edit + book
```

#### Notifications & User Control
```
Notification preferences for this trip:

Email:
[✓] Booking confirmations
[✓] Trip reminders (1 week, 1 day before)
[✓] Day-of schedule (each morning)
[ ] Live delay alerts

Push (app):
[✓] Entry reminders (1 hour before)
[✓] Live adjustments
[ ] Weather updates

SMS:
[ ] Critical alerts only
```

---

### G) Profile + Preferences

#### Profile Basics
```
/profile

[Avatar]

Alex Chen
alex@email.com
Member since Jan 2025

Home airport: San Francisco (SFO)
Currency: USD
Language: English

[Edit profile]
```

#### Travel Preferences
```
/profile/preferences

Travel Style

Pace:
○ Relaxed (2-3 activities/day)
● Moderate (4-5 activities/day)
○ Packed (6+ activities/day)

Budget range:
○ Budget
● Mid-range
○ Premium

Planning style:
● Structured (full itinerary)
○ Flexible (key highlights only)

━━━━━━━━━━━━━━━━━━━━━━━━━━

Interests (select all that apply):
[✓] Food & Dining
[✓] History & Culture
[ ] Nightlife
[✓] Nature & Parks
[ ] Shopping
[✓] Art & Museums

━━━━━━━━━━━━━━━━━━━━━━━━━━

Dietary:
[✓] Vegetarian options needed
[ ] Vegan
[ ] Gluten-free
[ ] Halal
[ ] Kosher

Mobility:
● No limitations
○ Prefer minimal walking
○ Wheelchair accessible required

[Save preferences]
```

#### Traveler Profiles
```
/profile/travelers

My Travelers

┌────────────────────────────────────┐
│ Alex (You)                         │
│ Adult • Primary account holder     │
│ [Edit]                             │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Jordan                             │
│ Adult • Frequent companion         │
│ Passport: •••• 4821                │
│ TSA PreCheck: Yes                  │
│ [Edit] [Remove]                    │
└────────────────────────────────────┘

[+ Add traveler]
```

#### Payment & Billing
```
/profile/payment

Payment Methods

┌────────────────────────────────────┐
│ 💳 Visa •••• 4242                  │
│ Expires 08/27                      │
│ Default                            │
│ [Edit] [Remove]                    │
└────────────────────────────────────┘

[+ Add payment method]

━━━━━━━━━━━━━━━━━━━━━━━━━━

Past Receipts

Mar 2025 — Tokyo Trip — $3,138.00 [Download]
```

#### Privacy Controls
```
/settings/privacy

Privacy & Data

Personalization:
[✓] Use my preferences to improve recommendations
[✓] Remember my search history
[ ] Share anonymized data for research

Data access:
[Export all my data] → Download JSON/CSV

Account deletion:
[Delete my account] → Requires confirmation

Transparency:
[✓] Show "Why recommended" on all suggestions
[✓] Include data sources in explanations
```

#### Saved Items
```
/saved

Saved Items

[Cities] [Experiences] [Itineraries]

━━━━━ CITIES ━━━━━

• Tokyo, Japan — Saved Jan 15
• Barcelona, Spain — Saved Dec 28
• Lisbon, Portugal — Saved Dec 10

[Start trip from saved city]

━━━━━ EXPERIENCES ━━━━━

• teamLab Borderless (Tokyo)
• La Boqueria Market (Barcelona)
• Tram 28 (Lisbon)

━━━━━ ITINERARIES ━━━━━

• "Perfect 3 Days in Tokyo" (Voyance curated)
• "Barcelona Long Weekend" (Voyance curated)
```

---

## SECTION 6: Trust, Transparency, and Anti-Hype Design System

### "Why This Is Recommended" Module
Every recommendation includes expandable rationale:

```
┌────────────────────────────────────────┐
│ teamLab Borderless                     │
│                                        │
│ Why we recommend it:                   │
│ "Unique immersive art experience with  │
│  timed entry that reduces wait times." │
│                                        │
│ [See full reasoning ▼]                 │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ Expanded detail:                   │ │
│ │                                    │ │
│ │ Timing data:                       │ │
│ │ • Weekday 10-11am: 15min avg wait │ │
│ │ • Weekend: 45-60min wait          │ │
│ │ • Based on 12 months of reports   │ │
│ │                                    │ │
│ │ Value assessment:                  │ │
│ │ • ¥3,200 is standard for Tokyo   │ │
│ │   major attractions               │ │
│ │ • 2-3 hour typical visit         │ │
│ │                                    │ │
│ │ Caveats:                          │ │
│ │ • Closes permanently Feb 2025     │ │
│ │ • Can be overwhelming for some    │ │
│ │ • Not ideal for very young kids   │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### Source Types
- **Timing data**: Aggregated visit patterns, not influencer claims
- **User feedback**: Verified travelers (not paid reviews)
- **Operator reliability**: Booking/cancellation history
- **Research**: Published travel data, official sources

### Disclaimers About Uncertainty
```
ℹ️ Limited data available
   This is a newer attraction. Timing recommendations
   are based on similar venues. Check closer to visit.

ℹ️ Variable conditions
   Crowd levels vary with events and holidays.
   We'll update recommendations as your date approaches.
```

### Review Handling
- No influencer partnerships or sponsored reviews
- Reviews aggregated from verified bookings
- Negative feedback shown alongside positive
- "Most helpful" not "most recent" as default sort

### "No Sponsored Ranking" Pledge
Visible in:
- Footer on every page
- About page prominently
- During sign-up (trust ritual)
- Expandable on any "why recommended"

```
Voyance Trust Pledge

✓ Rankings based on data, not payment
✓ We earn from bookings, not ads
✓ Every recommendation has a reason
✓ You can audit our logic

[Learn more about our approach]
```

### What Users Can Audit
- Full reasoning for any recommendation
- Data sources cited
- Known limitations acknowledged
- Comparison with alternatives

---

## SECTION 7: Microcopy Library

### CTA Buttons (Non-Hype Language)
```
Good:
• "Start planning"
• "See options"
• "Add to trip"
• "Continue"
• "Book now"
• "View details"
• "Compare"

Avoid:
• "Grab this deal!"
• "Don't miss out!"
• "Book before it's gone!"
• "Unlock exclusive access!"
```

### Onboarding Questions
```
"What should we call you?"
  (not: "Tell us your name!")

"Where are you based?"
  Helper: "We'll suggest flights from nearby airports"
  (not: "Unlock personalized recommendations!")

"How do you like to travel?"
  ○ Relaxed — Fewer activities, more flexibility
  ○ Moderate — Balanced mix of plans and downtime
  ○ Packed — See as much as possible
```

### Itinerary Explanation Snippets
```
"Why this order"
"We've sequenced these to minimize backtracking.
 Morning at Tsukiji (peak freshness), then east
 to teamLab (afternoon light best for photos)."

"Why this time"
"Senso-ji is crowded 10am-2pm. Arriving at 3pm
 gives you the temple with fewer crowds and
 better photo lighting."

"Tradeoff note"
"This adds 20 minutes of transit but saves an
 estimated 45 minutes of waiting."
```

### Booking Confirmations
```
"Booking confirmed"
"Your Tokyo trip is booked. Confirmation details
 sent to alex@email.com."

"You're all set"
"Flight, hotel, and teamLab tickets are confirmed.
 Access them anytime in My Trips."

"Partially booked"
"Hotel confirmed. We're still processing your
 flight—you'll get an update in a few minutes."
```

### Error States
```
Payment failed:
"Payment didn't go through. Please check your
 card details and try again. Your selections
 are saved."
 [Try again] [Use different card]

No availability:
"The 11am slot is no longer available.
 Here are alternative times:"
 [Show alternatives]

Network error:
"Connection lost. We've saved your progress.
 Please check your internet and try again."
 [Retry]
```

### Confidence Labels
```
"Best window: 8–10am"
  High confidence based on 14 months of data

"Likely less crowded after 4pm"
  Moderate confidence — varies by season

"Timing uncertain"
  Limited data available
```

---

## SECTION 8: Edge Cases + Recovery Patterns

### 1. User Has No Dates
**User sees**: Date picker with "Flexible dates?" option
**System does**: Shows best times to visit, seasonal recommendations

```
"Not sure when yet?"
[Explore best times for Tokyo]
→ Shows seasonal breakdown and price trends
```

### 2. Traveling with Kids
**User sees**: Age-specific filtering, kid-friendly badges
**System does**: Filters activities, adjusts pace, adds buffer time

```
Traveling with children (ages 4, 7)
✓ Added longer transit buffers
✓ Showing family-friendly activities
✓ Removed late-night options
```

### 3. Accessibility Constraints
**User sees**: Accessibility filter toggle, venue details
**System does**: Filters venues, shows accessibility info

```
Accessibility needs: Wheelchair accessible
✓ Showing only accessible venues
⚠️ Some temples have limited access—details shown
```

### 4. Last-Minute Trip (48 Hours)
**User sees**: "Traveling soon" quick-plan mode
**System does**: Shows only available bookings, prioritizes flexibility

```
"Traveling within 48 hours"
• Showing only confirmed-available options
• Prioritizing no-reservation experiences
• Skipping sold-out activities
```

### 5. Attractions Closed
**User sees**: Closure notice with alternatives
**System does**: Auto-suggests replacements

```
⚠️ teamLab Borderless is closed on Tuesdays

Suggested alternatives:
• teamLab Planets (similar, open Tues)
• Mori Art Museum
• Adjust itinerary to visit Wed instead
```

### 6. Sold Out Experiences
**User sees**: Waitlist option, alternatives
**System does**: Monitors for openings, suggests substitutes

```
"teamLab 11am is sold out"

Options:
○ Join waitlist (we'll notify if spots open)
○ Check 2pm slot
○ See alternatives
```

### 7. User Changes City Mid-Flow
**User sees**: Confirmation prompt, option to save draft
**System does**: Saves current progress, starts new planning session

```
"Start planning Barcelona instead?"

Your Tokyo draft will be saved.
[Switch to Barcelona] [Keep planning Tokyo]
```

### 8. Different Budgets Among Group Members
**User sees**: Per-person budget options, split-booking features
**System does**: Shows price per person, allows separate payments

```
Group budget:
Alex: Mid-range ($200/night)
Jordan: Budget ($100/night)

Options:
• Book 2 separate rooms
• Find mid-ground hotel (~$150)
• Show split-cost breakdown
```

### 9. Weak Internet Abroad
**User sees**: Offline mode prompt, downloaded content
**System does**: Pre-downloads trip data, works offline

```
"Download trip for offline access?"

Includes:
✓ Full itinerary
✓ Tickets and QR codes
✓ Venue addresses and maps
✓ Emergency contacts

[Download (12 MB)]
```

### 10. Time Zone Confusion
**User sees**: Local time prominently, home time in parentheses
**System does**: All times shown in destination local time

```
Your arrival: Mar 15, 3:30pm Tokyo time
(That's Mar 15, 11:30pm PST)

All itinerary times are in Tokyo time (JST, UTC+9)
[Show in my home time zone]
```

### 11. Booking Cancellation
**User sees**: Cancel flow with refund info, rebooking options
**System does**: Processes cancellation, updates trip, issues refund

```
"Cancel teamLab tickets?"

Refund: $44.00 → Original payment method
Processing time: 3-5 business days

This will remove the activity from your itinerary.
[Confirm cancellation] [Keep booking]
```

### 12. Dispute/Chargeback Risk
**User sees**: Issue reporting flow, support contact
**System does**: Documents issue, initiates resolution, provides support

```
"Report an issue with your booking"

What happened?
○ Vendor didn't honor reservation
○ Different from description
○ Charged incorrect amount
○ Other issue

[Submit report]

A support specialist will respond within 24 hours.
```

---

## SECTION 9: Data Objects + State Model

### Core Entities

```typescript
// User: Created at sign-up
User {
  id: string
  email: string
  name: string
  homeAirport?: string
  currency: string
  language: string
  createdAt: timestamp
}

// TravelerProfile: Created when adding companions
TravelerProfile {
  id: string
  userId: string (owner)
  name: string
  type: 'self' | 'companion'
  dateOfBirth?: date
  passportNumber?: string (encrypted)
  tsaPrecheck?: boolean
}

// PreferenceProfile: Created progressively
PreferenceProfile {
  userId: string
  pace: 'relaxed' | 'moderate' | 'packed'
  budget: 'budget' | 'midrange' | 'premium'
  interests: string[]
  dietary: string[]
  mobility: 'none' | 'minimal' | 'wheelchair'
  updatedAt: timestamp
}

// Trip: Created when starting planning
Trip {
  id: string
  userId: string
  name: string
  destination: string
  startDate: date
  endDate: date
  travelers: TravelerProfile[]
  status: 'draft' | 'planned' | 'booked' | 'active' | 'completed'
  createdAt: timestamp
}

// Itinerary: Created when building trip
Itinerary {
  id: string
  tripId: string
  days: ItineraryDay[]
  version: number
  createdAt: timestamp
}

// ItineraryDay: Part of itinerary
ItineraryDay {
  date: date
  items: ItineraryItem[]
}

// ItineraryItem: Individual activity/meal/transit
ItineraryItem {
  id: string
  type: 'activity' | 'meal' | 'transit' | 'accommodation' | 'free'
  name: string
  startTime: time
  endTime: time
  venue?: Venue
  booking?: Booking
  isLocked: boolean
  confidence: 'high' | 'moderate' | 'low'
}

// Booking: Created at checkout
Booking {
  id: string
  tripId: string
  type: 'flight' | 'hotel' | 'activity' | 'restaurant'
  status: 'pending' | 'confirmed' | 'cancelled'
  vendorConfirmation: string
  price: number
  currency: string
  cancellationPolicy: string
  createdAt: timestamp
}

// SavedItem: Created on save action
SavedItem {
  id: string
  userId: string
  type: 'city' | 'experience' | 'itinerary'
  referenceId: string
  savedAt: timestamp
}

// Notification: Created by system
Notification {
  id: string
  userId: string
  tripId?: string
  type: 'reminder' | 'update' | 'alert'
  title: string
  message: string
  read: boolean
  createdAt: timestamp
}
```

### State Lifecycle

```
User Sign-up
  └→ User created
  └→ PreferenceProfile created (empty)
  
Onboarding
  └→ PreferenceProfile updated
  └→ TravelerProfile (self) created
  
Start Planning
  └→ Trip created (status: draft)
  
Build Itinerary
  └→ Itinerary created
  └→ ItineraryDays + ItineraryItems created
  
Add Companion
  └→ TravelerProfile created
  └→ Trip.travelers updated
  
Book
  └→ Booking(s) created
  └→ Trip status → 'booked'
  └→ ItineraryItem.booking linked
  
Trip Active
  └→ Trip status → 'active'
  └→ Notifications created
  
Trip Complete
  └→ Trip status → 'completed'
  └→ Feedback requested
```

---

## SECTION 10: Success Metrics

### Experience Metrics

| Metric | Definition | Good |
|--------|------------|------|
| Time-to-first-value | Time from landing to first useful action | < 60 seconds |
| Itinerary generation rate | % of users who generate at least 1 itinerary | > 40% |
| Itinerary completion rate | % of started itineraries completed (all days filled) | > 70% |
| Edits per itinerary | Average modifications before finalizing | 3-6 (engaged, not confused) |
| Save rate (guests) | % of guests who try to save (prompts sign-up) | > 25% |
| Sign-up conversion | % of guests who create account | > 15% |

### Business Metrics

| Metric | Definition | Good |
|--------|------------|------|
| Booking conversion | % of completed itineraries that convert to booking | > 20% |
| Revenue per trip | Average booking value | $1,500+ |
| Refund/cancel rate | % of bookings cancelled | < 10% |
| Support contact rate | % of trips with support tickets | < 5% |
| Repeat booking rate | % of users who book 2+ trips | > 30% (year 1) |

### Trust Metrics

| Metric | Definition | Good |
|--------|------------|------|
| NPS (planning phase) | Net Promoter Score during planning | > 50 |
| NPS (during trip) | Net Promoter Score during travel | > 60 |
| NPS (post-trip) | Net Promoter Score after return | > 55 |
| "Why recommended" clicks | % of users who expand reasoning | > 15% |
| Trust pledge views | % who view full trust explanation | > 5% |

### Engagement Metrics

| Metric | Definition | Good |
|--------|------------|------|
| Saved cities → new trips | % of saved cities that become trips | > 20% |
| Return visits | Users who return within 30 days | > 40% |
| Mobile vs desktop completion | Booking completion by device | Desktop > 60% |
| Companion invites | Avg companions per trip | > 0.5 |

---

## NARRATIVE WALKTHROUGH: 3-Day NYC Trip

### The User: Sarah, First-Time NYC Visitor

Sarah is a 32-year-old marketing manager from Seattle. She's never been to NYC and has a long weekend (Friday-Sunday) coming up. She's excited but overwhelmed by options.

### Her Journey:

**Discovery (Thursday evening)**

Sarah searches "NYC weekend trip" and lands on Voyance. The homepage immediately feels different—no "TOP 10 HIDDEN GEMS!" headlines. Instead:

> "Plan trips that respect your time."

She scrolls and sees "NYC: Best for first-timers" with a clear breakdown: best neighborhoods to stay, optimal timing for major attractions, and honest assessments.

*Feeling: Curious, relieved ("this feels professional").*

**Exploration (20 minutes in)**

Sarah clicks into the NYC guide. She sees:
- **Central Park**: "Best window: 8-10am weekdays. Avoid 11am-3pm weekends."
- **Statue of Liberty**: "Book 2+ weeks ahead. Ferry from Battery Park, not the tourist-trap boats."
- **Times Square**: "15 minutes is enough. Visit at night for photos, don't plan dinner here (overpriced)."

Each card explains WHY. She starts to trust the recommendations.

*Feeling: Engaged, trusting ("they're telling me what locals know").*

**Building the Trip (30 minutes in)**

Sarah clicks "Plan a NYC Trip." She enters:
- Dates: Mar 7-9
- Travelers: Just her
- Flying from: Seattle

The system generates a 3-day itinerary:

**Day 1 (Friday):**
- 6pm: Land at JFK
- 8pm: Hotel check-in (Moxy Times Square recommended: "Central, reasonable, quiet rooms despite location")
- 9pm: Light dinner in Hell's Kitchen ("skip Times Square restaurants")

**Day 2 (Saturday):**
- 8am: Central Park walk ("before crowds")
- 11am: MoMA ("timed entry, skip the line")
- 2pm: Chelsea Market lunch
- 4pm: High Line walk
- 7pm: Dinner reservation (system suggests two options based on her pace preference)

**Day 3 (Sunday):**
- 9am: Statue of Liberty (pre-booked ferry)
- 12pm: Brunch in SoHo
- 3pm: Flight home

Each activity includes timing rationale. She can see the map view to understand the routing.

*Feeling: Confident ("this makes sense"), excited ("I'm actually going to do this").*

**Customization (10 minutes)**

Sarah drags "MoMA" to Day 3 and swaps in "Whitney Museum" for Saturday. The system automatically adjusts transit times and warns: "Whitney opens at 10:30am—we've adjusted your start time."

She locks in "Statue of Liberty" as a must-do.

*Feeling: In control, satisfied ("I'm personalizing without breaking the plan").*

**Booking (15 minutes)**

Sarah clicks "Book everything." She sees:
- Flight: Alaska 1234, $287
- Hotel: Moxy, $189/night × 2 = $378
- Statue of Liberty: $24 (timed ferry)

Total: $689

Cancellation policies are clear. She adds her card and confirms.

*Feeling: Trust ("no surprise fees"), accomplished ("trip is booked!").*

**Confirmation**

> "Your NYC trip is booked! Confirmation sent to sarah@email.com."
> "Access your trip anytime in My Trips."

She sees her trip dashboard with downloadable tickets and a "Trip starts in 14 days" countdown.

*Feeling: Excitement, peace of mind ("everything is handled").*

**Day of Travel (2 weeks later)**

Friday morning, Sarah gets a push notification:
> "Your NYC trip starts today! ✈️ Flight departs 2pm PST."

She opens the app and sees her "Today View" with flight details, hotel address, and dinner suggestion.

On Saturday morning:
> "Good morning! Central Park first at 8am—it's 45°F and clear. ☀️"

At 10:30am:
> "Heading to MoMA next. 15-minute walk from your current location."

When she's near Times Square:
> "Quick photo op! Times Square is 2 blocks away. Remember: 15 minutes is plenty."

*Feeling: Supported, stress-free ("I know exactly what to do").*

**Post-Trip**

After returning home, Sarah gets an email:
> "How was your NYC trip? Help us improve for future travelers."

She gives a quick rating and notes that the MoMA timing was perfect. This feedback improves future recommendations.

She saves "Tokyo" for her next trip.

*Feeling: Satisfied, loyal ("I'll definitely use this again").*

---

## Summary

This UX specification defines Voyance as the anti-influencer travel platform that:

1. **Builds trust** through transparency, not marketing
2. **Saves time** through intelligent sequencing
3. **Empowers decisions** with data, not hype
4. **Supports execution** throughout the journey
5. **Improves continuously** through honest feedback

Every screen, interaction, and piece of microcopy should reinforce: "We've done the research so you don't have to."
