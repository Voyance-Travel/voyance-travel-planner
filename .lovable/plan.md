

# Collaborative Trip Profile Blending UX

## Overview

This plan adds user control and visibility to the Travel DNA profile blending system. Currently, when friends are linked to a trip, their preferences are automatically blended with the trip owner's profile (owner gets 1.5x weight). However, users have no control over this process and no visibility into how preferences were merged.

## Current State

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     CURRENT PROFILE BLENDING FLOW                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Link Friend to Trip ──► Collaborator Added ──► Generation Triggered   │
│                                                                         │
│                    (Automatic blending, no user control)                │
│                                                                         │
│  Backend fetches all collaborator preferences automatically             │
│  Owner gets 1.5x weight in blending algorithm                           │
│  No UI feedback about what was blended                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Proposed Solution: Four New Features

### Feature 1: Blend Toggle in Link-to-Trip Flow

Add an option when linking a friend to include or exclude their preferences from itinerary generation.

**Where**: `LinkToTripModal.tsx` and `TripCollaboratorsPanel.tsx`

**Database Change**: Add `include_preferences` boolean column to `trip_collaborators` table (default: true)

**UI Addition**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Link to Trip                                                     [X]  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  [Avatar] Sarah Chen                                              │  │
│  │  @sarahchen                                                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ [Toggle ON]  Include Travel DNA in itinerary                    │   │
│  │              Their preferences will blend with yours            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Select a trip:                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ [✓] Paris Adventure                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                      [Cancel]  [Link]                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Feature 2: Blended Profiles Visibility Card

Show which profiles were combined and highlight any compromises in the itinerary view.

**Where**: New component `BlendedProfilesCard.tsx` displayed in `EditorialItinerary.tsx`

**UI Addition**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Blended Travel DNA                                              [▼]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Avatar] You (organizer)     ●────────── 60% weight                    │
│  Balanced Story Collector                                               │
│                                                                         │
│  [Avatar] Sarah Chen          ○───────── 40% weight                     │
│  Luxury Curator                                                         │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Blended Result:                                                        │
│  • Pace: Moderate (both aligned)                                        │
│  • Budget: Mid-range → Upscale (compromised for Sarah)                  │
│  • Dining: Balanced mix of local + fine dining                          │
│  • Dietary: Vegetarian included (Sarah's requirement)                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Feature 3: DNA Quiz Prompt for Guests

When a friend without Travel DNA is added, show a gentle prompt encouraging them to complete the quiz.

**Where**: `TripCollaboratorsPanel.tsx` and potentially a notification/email

**UI Addition**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Trip Members                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Avatar] You                              [Crown] Owner                │
│                                                                         │
│  [Avatar] Sarah Chen                       [DNA Icon] Contributor       │
│           87% compatible                                                │
│                                                                         │
│  [Avatar] Mike Johnson                     [!] Contributor              │
│           ┌──────────────────────────────────────────────────────┐     │
│           │ No Travel DNA yet                                     │     │
│           │ Invite Mike to take the quiz so their preferences     │     │
│           │ can be included in your itinerary.                    │     │
│           │                                                       │     │
│           │ [Send Quiz Invite]                                    │     │
│           └──────────────────────────────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Feature 4: Group Compatibility Card

Show overall group travel compatibility and highlight potential preference conflicts.

**Where**: New component `GroupCompatibilityCard.tsx` in `TripCollaboratorsPanel.tsx`

**UI Addition**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Group Compatibility                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│       ┌────────────────┐                                                │
│       │                │                                                │
│       │      78%       │  ← Overall group compatibility                 │
│       │                │                                                │
│       └────────────────┘                                                │
│                                                                         │
│  Aligned On:                                                            │
│  ✓ Cultural Experiences    ✓ Food Adventures    ✓ Moderate Pace        │
│                                                                         │
│  May Need Compromise:                                                   │
│  ⚡ Budget (Value vs Luxury)                                            │
│  ⚡ Morning Schedule (Early Bird vs Late Riser)                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Database Changes

**New column on `trip_collaborators` table:**

```sql
ALTER TABLE trip_collaborators 
ADD COLUMN include_preferences BOOLEAN DEFAULT true;

COMMENT ON COLUMN trip_collaborators.include_preferences IS 
'Whether to include this collaborator preferences in itinerary generation blending';
```

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/itinerary/BlendedProfilesCard.tsx` | Shows blended DNA breakdown |
| `src/components/itinerary/GroupCompatibilityCard.tsx` | Shows overall group compatibility |
| `src/components/itinerary/DNAQuizPrompt.tsx` | Prompt for guests without DNA |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/profile/LinkToTripModal.tsx` | Add blend toggle switch |
| `src/components/itinerary/TripCollaboratorsPanel.tsx` | Add compatibility display, DNA quiz prompt, blend toggle per collaborator |
| `src/services/tripCollaboratorsAPI.ts` | Add `include_preferences` to types and mutations |
| `supabase/functions/generate-itinerary/index.ts` | Respect `include_preferences` flag when fetching collaborator preferences |
| `src/components/itinerary/EditorialItinerary.tsx` | Add BlendedProfilesCard to sidebar |

---

## Detailed Component Specifications

### BlendedProfilesCard.tsx

```typescript
interface BlendedProfilesCardProps {
  tripId: string;
  ownerId: string;
}

// Displays:
// - Owner's archetype and weight (60%)
// - Each collaborator's archetype and weight (40% / n)
// - Blended result summary:
//   - Aligned traits (both users agree)
//   - Compromised traits (averaged/adjusted)
//   - Merged requirements (dietary, accessibility)
```

### GroupCompatibilityCard.tsx

```typescript
interface GroupCompatibilityCardProps {
  tripId: string;
  collaborators: TripCollaborator[];
}

// Calculates:
// - Pairwise compatibility between all travelers
// - Average overall compatibility score
// - Identifies aligned traits (low variance across group)
// - Identifies conflict traits (high variance across group)
```

### LinkToTripModal.tsx Changes

Add a Switch component below the friend preview:

```tsx
<div className="flex items-center justify-between py-3 border-b">
  <div className="space-y-0.5">
    <Label htmlFor="blend-toggle" className="text-sm font-medium">
      Include Travel DNA
    </Label>
    <p className="text-xs text-muted-foreground">
      Blend their preferences when generating itinerary
    </p>
  </div>
  <Switch
    id="blend-toggle"
    checked={includePreferences}
    onCheckedChange={setIncludePreferences}
  />
</div>
```

### Backend Changes (generate-itinerary/index.ts)

Update `getCollaboratorPreferences` to filter by `include_preferences`:

```typescript
// Line ~2277: Add filter for include_preferences
const { data: collaborators, error: collabError } = await supabase
  .from('trip_collaborators')
  .select('user_id, include_preferences')
  .eq('trip_id', tripId)
  .eq('include_preferences', true); // Only include if flag is true
```

---

## User Experience Flow

```text
1. Link Friend to Trip
   ├── See friend's compatibility score (if DNA exists)
   ├── Toggle: "Include Travel DNA" (default: ON)
   └── If friend has no DNA → Show "Complete Quiz" prompt

2. View Trip Collaborators
   ├── See each collaborator with compatibility %
   ├── Toggle blend ON/OFF per collaborator
   └── "No DNA" badge with quiz invite for incomplete profiles

3. Generate Itinerary
   ├── Backend filters collaborators by include_preferences
   ├── Blends only opted-in profiles
   └── Returns blend metadata with response

4. View Itinerary
   ├── Blended Profiles Card shows who was included
   ├── Highlights compromises and alignments
   └── Group Compatibility Card shows overall match
```

---

## Design Considerations

Following the "Friend, Not Nuisance" philosophy:

- Default blend to ON (invisible helper pattern)
- Compatibility scores shown as celebration ("87% aligned!")
- Conflicts framed as "May need compromise" not "Mismatch detected"
- Quiz prompts are gentle invitations, not blocking gates
- All toggles remember user preference per collaborator

---

## Summary of Changes

| Area | What's Added |
|------|--------------|
| **Database** | `include_preferences` column on `trip_collaborators` |
| **LinkToTripModal** | Blend toggle switch |
| **TripCollaboratorsPanel** | Compatibility scores, per-user blend toggle, DNA quiz prompt |
| **EditorialItinerary** | BlendedProfilesCard in sidebar |
| **Backend** | Filter by `include_preferences` in blending logic |
| **New Components** | BlendedProfilesCard, GroupCompatibilityCard, DNAQuizPrompt |

