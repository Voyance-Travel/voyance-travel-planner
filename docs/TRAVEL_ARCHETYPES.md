# Travel Archetypes - Source of Truth

## Overview

This document serves as the **definitive reference** for Travel DNA archetypes, bridging backend logic with frontend emotional storytelling. It ensures users receive personalized, horoscope-like insights that make them say "How did you know that about me?"

## ⚠️ CRITICAL: System Architecture

1. **Backend generates**: Archetype ID, rarity, trait scores, confidence percentage
2. **Frontend transforms**: Raw data into emotional narrative, visual design, and personalized copy
3. **User receives**: A deeply personal travel identity that feels uniquely theirs

---

## Backend Archetype System

### Total Archetypes: 25+

The backend uses a hierarchical scoring model to determine primary and secondary archetypes from quiz responses.

### Archetype Categories (6 Total)

1. **EXPLORER** - Discovery-driven travelers
2. **CONNECTOR** - Relationship-driven travelers  
3. **ACHIEVER** - Goal-driven travelers
4. **RESTORER** - Wellness-driven travelers
5. **CURATOR** - Experience-driven travelers
6. **TRANSFORMER** - Change-driven travelers

### Rarity Calculation

Based on extreme trait scores (values >7 or <-7):
- **very rare** - 4+ extreme traits (~2-5% of users)
- **uncommon** - 2-3 extreme traits (~15-20% of users)
- **moderate** - 1 extreme trait (~30-40% of users)
- **common** - No extreme traits (~40-50% of users)

---

## Complete Archetype Registry

### EXPLORERS

#### 1. The Cultural Anthropologist
- **ID**: `cultural_anthropologist`
- **Rarity**: uncommon
- **Primary Motivation**: Understanding humanity through immersive cultural experiences
- **Core Values**: authenticity, learning, respect, immersion
- **Backend Scoring**: High cultural + authenticity scores
- **Emotional Hook**: "You don't just visit places, you become them"

#### 2. The Urban Nomad
- **ID**: `urban_nomad`
- **Rarity**: common
- **Primary Motivation**: Discovering the pulse of global cities
- **Core Values**: diversity, energy, innovation, culture
- **Backend Scoring**: High pace + social + cultural scores
- **Emotional Hook**: "Cities speak to you in neon and noise"

#### 3. The Wilderness Pioneer
- **ID**: `wilderness_pioneer`
- **Rarity**: uncommon
- **Primary Motivation**: Finding untouched nature and remote frontiers
- **Core Values**: solitude, challenge, nature, self-reliance
- **Backend Scoring**: High nature + adventure, low luxury scores
- **Emotional Hook**: "WiFi is optional, wilderness is essential"

#### 4. The Untethered Traveler
- **ID**: `digital_explorer`
- **Rarity**: common
- **Primary Motivation**: Blending remote work with global exploration
- **Core Values**: flexibility, connectivity, productivity, adventure
- **Backend Scoring**: High flexibility + structure scores
- **Emotional Hook**: "Your office view changes, your output doesn't"

### CONNECTORS

#### 5. The Social Butterfly
- **ID**: `social_butterfly`
- **Rarity**: common
- **Primary Motivation**: Creating connections and shared memories
- **Core Values**: friendship, celebration, sharing, energy
- **Backend Scoring**: High social + connection scores
- **Emotional Hook**: "Strangers are just friends with better stories"

#### 6. The Family Architect
- **ID**: `family_architect`
- **Rarity**: common
- **Primary Motivation**: Building multi-generational memories
- **Core Values**: togetherness, safety, education, bonding
- **Backend Scoring**: High social + structure + comfort scores
- **Emotional Hook**: "Making memories that outlive photo albums"

#### 7. The Romantic Curator
- **ID**: `romantic_curator`
- **Rarity**: uncommon
- **Primary Motivation**: Creating intimate moments and couple connections
- **Core Values**: intimacy, beauty, privacy, romance
- **Backend Scoring**: Moderate social + high luxury/comfort scores
- **Emotional Hook**: "Two tickets to everywhere that matters"

#### 8. The Community Builder
- **ID**: `community_builder`
- **Rarity**: rare
- **Primary Motivation**: Fostering local connections and giving back
- **Core Values**: service, empathy, sustainability, impact
- **Backend Scoring**: High connection + authenticity + low budget consciousness
- **Emotional Hook**: "Leave places better than you found them"

### ACHIEVERS

#### 9. The Bucket List Conqueror
- **ID**: `bucket_list_conqueror`
- **Rarity**: common
- **Primary Motivation**: Checking off iconic experiences
- **Core Values**: achievement, recognition, efficiency, completion
- **Backend Scoring**: High achievement + structure scores
- **Emotional Hook**: "Life's too short for someday"

#### 10. The Adrenaline Architect
- **ID**: `adrenaline_architect`
- **Rarity**: uncommon
- **Primary Motivation**: Pushing physical and mental boundaries
- **Core Values**: challenge, risk, intensity, growth
- **Backend Scoring**: Very high adventure + achievement scores
- **Emotional Hook**: "Normal is just a setting on the washing machine"

#### 11. The Collection Curator
- **ID**: `collection_curator`
- **Rarity**: rare
- **Primary Motivation**: Systematically experiencing specific themes
- **Core Values**: completeness, expertise, depth, mastery
- **Backend Scoring**: High structure + specific interest scores
- **Emotional Hook**: "Depth over breadth, always"

#### 12. The Status Seeker
- **ID**: `status_seeker`
- **Rarity**: uncommon
- **Primary Motivation**: Experiencing exclusive destinations
- **Core Values**: exclusivity, luxury, recognition, quality
- **Backend Scoring**: Very high luxury + low budget consciousness
- **Emotional Hook**: "First class isn't a seat, it's a standard"

### RESTORERS

#### 13. The Zen Seeker
- **ID**: `zen_seeker`
- **Rarity**: common
- **Primary Motivation**: Finding peace and spiritual renewal
- **Core Values**: tranquility, mindfulness, simplicity, healing
- **Backend Scoring**: High restoration + wellness, low pace scores
- **Emotional Hook**: "Breathe in experience, exhale expectation"

#### 14. The Retreat Regular
- **ID**: `retreat_regular`
- **Rarity**: uncommon
- **Primary Motivation**: Structured wellness and self-improvement
- **Core Values**: growth, health, routine, transformation
- **Backend Scoring**: High wellness + structure + restoration scores
- **Emotional Hook**: "Invest in rest, compound the interest"

#### 15. The Beach Therapist
- **ID**: `beach_therapist`
- **Rarity**: common
- **Primary Motivation**: Ocean-based relaxation and vitamin sea
- **Core Values**: relaxation, nature, simplicity, rhythm
- **Backend Scoring**: High restoration + nature, low adventure scores
- **Emotional Hook**: "Salt water cures everything"

#### 16. The Slow Traveler
- **ID**: `slow_traveler`
- **Rarity**: uncommon
- **Primary Motivation**: Deep immersion through extended stays
- **Core Values**: depth, patience, integration, presence
- **Backend Scoring**: Very low pace + high authenticity scores
- **Emotional Hook**: "Stay long enough to have a favorite café"

### CURATORS

#### 17. The Culinary Cartographer
- **ID**: `culinary_cartographer`
- **Rarity**: uncommon
- **Primary Motivation**: Mapping the world through taste
- **Core Values**: flavor, authenticity, craft, discovery
- **Backend Scoring**: Very high culinary experience scores
- **Emotional Hook**: "Your passport is basically a menu"

#### 18. The Art Aficionado
- **ID**: `art_aficionado`
- **Rarity**: rare
- **Primary Motivation**: Experiencing global creativity
- **Core Values**: beauty, creativity, culture, expression
- **Backend Scoring**: High cultural + luxury scores
- **Emotional Hook**: "Museums are just the beginning"

#### 19. The Luxury Luminary
- **ID**: `luxury_luminary`
- **Rarity**: uncommon
- **Primary Motivation**: Curating premium experiences
- **Core Values**: excellence, comfort, service, sophistication
- **Backend Scoring**: Maximum luxury + comfort scores
- **Emotional Hook**: "Champagne wishes, caviar dreams, economy never"

#### 20. The Eco Ethicist
- **ID**: `eco_ethicist`
- **Rarity**: uncommon
- **Primary Motivation**: Sustainable and responsible travel
- **Core Values**: sustainability, conservation, respect, future
- **Backend Scoring**: High authenticity + nature, specific eco preferences
- **Emotional Hook**: "Take only pictures, leave only footprints, create only positive impact"

### TRANSFORMERS

#### 21. The Gap Year Graduate
- **ID**: `gap_year_graduate`
- **Rarity**: common
- **Primary Motivation**: Self-discovery through extended travel
- **Core Values**: growth, independence, discovery, freedom
- **Backend Scoring**: High flexibility + discovery + low structure
- **Emotional Hook**: "Finding yourself requires getting lost first"

#### 22. The Midlife Explorer
- **ID**: `midlife_explorer`
- **Rarity**: uncommon
- **Primary Motivation**: Rediscovering self through new horizons
- **Core Values**: renewal, courage, authenticity, vitality
- **Backend Scoring**: Mixed scores with transformation indicators
- **Emotional Hook**: "Chapter two starts at departure gate"

#### 23. The Sabbatical Scholar
- **ID**: `sabbatical_scholar`
- **Rarity**: rare
- **Primary Motivation**: Deep learning and skill development
- **Core Values**: education, immersion, expertise, growth
- **Backend Scoring**: High learning + cultural + low time constraints
- **Emotional Hook**: "Every destination is a classroom"

#### 24. The Healing Journeyer
- **ID**: `healing_journeyer`
- **Rarity**: uncommon
- **Primary Motivation**: Travel as emotional healing
- **Core Values**: healing, renewal, self-care, transformation
- **Backend Scoring**: High restoration + escape + wellness scores
- **Emotional Hook**: "Miles traveled, healing multiplied"

#### 25. The Retirement Ranger
- **ID**: `retirement_ranger`
- **Rarity**: common
- **Primary Motivation**: Fulfilling lifetime dreams
- **Core Values**: freedom, fulfillment, legacy, adventure
- **Backend Scoring**: Age indicators + high flexibility + mixed interests
- **Emotional Hook**: "Finally living the postcard life"

---

## Backend API Response Format

### Endpoint: `GET /api/v1/user/preferences/travel-dna`

```json
{
  "success": true,
  "travelDNA": {
    "profileId": "uuid",
    "userId": "uuid",
    "primaryArchetype": {
      "id": "cultural_anthropologist",
      "name": "The Cultural Anthropologist",
      "category": "EXPLORER",
      "confidence": 92
    },
    "secondaryArchetype": {
      "id": "slow_traveler",
      "name": "The Slow Traveler",
      "category": "RESTORER",
      "confidence": 68
    },
    "rarity": "uncommon",
    "rarityPercentage": 18,
    "traitScores": {
      "adventure_level": 4.5,
      "authenticity_seeking": 9.2,
      "budget_consciousness": 3.1,
      "comfort_priority": 2.8,
      "cultural_engagement": 9.8,
      "flexibility": 7.3,
      "pace_preference": -8.5,
      "planning_style": 6.2,
      "social_preference": 1.2,
      "spontaneity": 3.5
    },
    "emotionalDrivers": [
      "understanding",
      "connection",
      "authenticity",
      "growth"
    ],
    "topTraits": [
      {"trait": "cultural engagement", "score": 9.8},
      {"trait": "authenticity seeking", "score": 9.2},
      {"trait": "slow pace", "score": 8.5}
    ],
    "calculatedAt": "2025-08-03T10:30:00Z"
  }
}
```

---

## Frontend Transformation Guide

### Visual Identity by Category

| Category | Primary Color | Secondary Color | Mood |
|----------|--------------|-----------------|------|
| EXPLORER | Deep Teal | Burnt Orange | Adventurous, Curious |
| CONNECTOR | Warm Rose | Golden Amber | Welcoming, Social |
| ACHIEVER | Royal Purple | Electric Blue | Ambitious, Dynamic |
| RESTORER | Sage Green | Soft Lavender | Calming, Peaceful |
| CURATOR | Rich Burgundy | Champagne Gold | Sophisticated, Refined |
| TRANSFORMER | Indigo | Sunrise Orange | Evolving, Hopeful |

### Narrative Structure

Each archetype reveal should include:

1. **Hook Line** - Immediate recognition moment
2. **Identity Statement** - "You are a [Archetype Name]"
3. **Rarity Badge** - "Only X% of travelers share this DNA"
4. **Core Description** - 2-3 sentences of recognition
5. **What This Means** - 3-4 bullet points of traits
6. **Your Superpowers** - Positive aspects
7. **Growth Edges** - Areas to explore
8. **Perfect Trip Preview** - Teaser of ideal experiences

### Example Frontend Copy

```typescript
{
  cultural_anthropologist: {
    hookLine: "You don't just visit places, you become them.",
    identity: "You are a Cultural Anthropologist",
    rarityBadge: "Only 18% of Voyance travelers share your rare combination",
    coreDescription: "While others see monuments, you see meaning. Your travels are doctoral dissertations in humanity, written in small cafés and local markets. You speak the universal language of curiosity.",
    whatThisMeans: [
      "You value authentic connections over tourist attractions",
      "You learn basic phrases in every language you encounter",
      "You'd rather eat street food with locals than dine alone in luxury",
      "You keep journals full of human stories, not just places"
    ],
    superpowers: [
      "Building bridges across cultural divides",
      "Finding extraordinary in ordinary moments",
      "Creating connections that transcend language"
    ],
    growthEdges: [
      "Sometimes comfort has its place too",
      "Not every meal needs a story",
      "Fellow travelers have wisdom to share"
    ],
    perfectTripPreview: "30 days in Morocco, speaking Arabic by week two, invited to three family dinners, leaving with recipes and lifelong friends."
  }
}
```

---

## Implementation Checklist

### Backend Tasks
- [x] Archetype calculation logic exists in `/src/services/engines/travelDNA/`
- [x] 25+ archetypes defined in `hierarchical-model.ts`
- [x] Rarity calculation implemented
- [x] API endpoint returns archetype data
- [ ] Add rarityPercentage calculation (currently only categories)
- [ ] Ensure all archetypes have complete scoring rules

### Frontend Tasks
- [x] Create `ARCHETYPE_NARRATIVES.ts` with emotional copy
- [x] Build `UserIdentityReveal.tsx` component
- [x] Design visual system for each category
- [x] Implement `useArchetypeData()` hook
- [ ] Create shareable archetype cards
- [ ] Add "This isn't me" refinement option

### Shared Tasks
- [ ] Validate all 25 archetypes have frontend narratives
- [ ] QA test archetype assignment accuracy
- [ ] A/B test emotional copy variations
- [ ] Track user engagement with identity reveals

---

## Future Enhancements

1. **Archetype Evolution** - Show how travel DNA changes over time
2. **Compatibility Matching** - Match travelers with compatible archetypes
3. **Destination DNA** - Match destinations to archetype preferences
4. **Dynamic Narratives** - AI-generated personalized descriptions
5. **Visual DNA Cards** - Shareable social media assets

---

## Success Metrics

- User feedback: "This is exactly me!" rate > 80%
- Share rate of archetype results > 40%
- Profile completion after reveal > 90%
- Return visits to view identity > 60%

---

## Last Updated

August 3, 2025

This document is the canonical reference for Travel DNA archetypes. Any changes to archetype logic, scoring, or narratives must be reflected here.