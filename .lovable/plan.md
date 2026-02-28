

# Fix Viewer Permission & Improve Post-Member-Add Behavior

## Problem 1: Viewer Not Working

The permission dropdown in `TripCollaboratorsPanel.tsx` uses `SelectItem value="viewer"` (line 406) but the `CollaboratorPermission` type is `'view' | 'edit' | 'admin'`. This means:
- Selecting "Viewer" sends `"viewer"` to the RPC instead of `"view"` -- it silently fails or stores an invalid value
- The dropdown never shows "Viewer" as currently selected because `collaborator.permission` is `"view"` which doesn't match `"viewer"`

**Fix**: Change `value="viewer"` to `value="view"` and `value="editor"` to `value="edit"` in the Select component.

**File**: `src/components/itinerary/TripCollaboratorsPanel.tsx` (lines 406, 412)

---

## Problem 2: Post-Member-Add Should Not Offer Full Regeneration

Currently when a member is added, a toast says "Regenerate the itinerary to blend their preferences" with a Regenerate button. This is heavy-handed -- it wipes out the existing itinerary.

**Instead, the behavior should be:**

1. Show the colored collaborator attribution dots on activities (this already works via `suggestedFor` + `collaboratorColorMap`) -- but refresh the color map immediately when a member is added so the legend updates.

2. Replace the "Regenerate" toast with a friendlier message offering to **add activities** for the newcomer:
   - Toast: "[Name] added to the trip! We found activities that match their interests too."
   - Action button: "Add activities for [Name]" (or "Personalize" -- a lighter touch)
   - This button could scroll to a new banner or trigger an "enrich" flow that adds supplementary activities without replacing existing ones.

3. Add a **NewMemberSuggestionsCard** inline component that appears after a member is added:
   - Shows which existing activities already align with the new member's interests (with their color dot)
   - Offers to add 2-3 new activities per day that match the newcomer's DNA
   - "Add these" / "Skip" buttons
   - This is a lighter touch than regenerating the entire itinerary

**Files to change:**

- `src/components/itinerary/EditorialItinerary.tsx` (lines 4980-4995): Replace the `onMemberAdded` callback to show the new flow instead of the regenerate toast
- `src/components/itinerary/TripCollaboratorsPanel.tsx`: Ensure the collaborator list refetch triggers the color map to update
- Create `src/components/itinerary/NewMemberSuggestionsCard.tsx`: A card that shows after a member is added, highlighting shared interests and offering to add personalized activities

---

## Technical Details

### Fix 1: SelectItem Values (TripCollaboratorsPanel.tsx)

```text
Line 406: SelectItem value="viewer" --> value="view"
Line 412: SelectItem value="editor" --> value="edit"
```

### Fix 2: onMemberAdded Flow (EditorialItinerary.tsx)

Replace the current toast (lines 4980-4994) with:
- A toast that says "[Name] has joined! We'll highlight activities matching their interests."
- No "Regenerate" action button
- Instead, set a state flag like `newlyAddedMember` that renders a `NewMemberSuggestionsCard` inline
- The card shows: "Activities [Name] will love" based on their DNA overlap, plus "Add new activities for [Name]" which calls a lighter endpoint (or adds placeholder activities the owner can customize)
- Remove the automatic `setShowGroupUnlockModal(true)` trigger -- only show it if the owner explicitly tries to use a paid feature

### Fix 3: NewMemberSuggestionsCard Component

A new component that:
- Takes the new member's profile/DNA and the current itinerary days
- Cross-references activities' tags/categories with the member's archetype affinities
- Shows existing activities that overlap with colored attribution dots
- Offers to add 2-3 suggested activities per day
- Has "Add these" and "Maybe later" buttons
- Dismissible, stored in local state (not persistent)

## Sequencing

1. Fix the `value="viewer"` / `value="editor"` bug (quick fix)
2. Update the `onMemberAdded` callback to show the new friendlier toast
3. Create the `NewMemberSuggestionsCard` component
4. Wire it into the `EditorialItinerary` layout (appears after member is added)
