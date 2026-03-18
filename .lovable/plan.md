

## Two Features: Trip Venue Memory + User Photo Management

### Feature 1: Trip Venue Bank (Auto-suggestions from previously entered data)

**Concept**: As a user fills in venue names, addresses, and websites across activities in a trip, the system remembers them. Next time the user opens Edit Details for another activity, the inputs offer suggestions from previously used values within the same trip.

**How it works**:
- Create a new hook `useTripVenueBank(days)` that scans all activities in the current trip's `days` state and extracts unique venue names, addresses, and websites into categorized lists.
- No database changes needed — this is purely derived from existing in-memory itinerary state.
- In `EditActivityModal.tsx`, accept a `venueBank` prop and render a small suggestion chip list (or a dropdown/combobox) below the Venue Name, Address, and Website fields when the field is focused and the bank has matching entries.
- Clicking a suggestion auto-fills that field. Selecting a venue name also auto-fills the matching address and website if available.

**Files to change**:
| # | File | Change |
|---|------|--------|
| 1 | `src/hooks/useTripVenueBank.ts` | **New file.** Scans `days` array, extracts unique `{ name, address, website }` tuples from all activities. Returns `{ venues, addresses, websites }` arrays. Memoized. |
| 2 | `src/components/itinerary/EditActivityModal.tsx` | Accept optional `venueBank` prop. When venue name field is focused, show matching suggestions as clickable chips. Auto-fill address/website when a known venue is selected. Same for address and website fields independently. |
| 3 | `src/components/itinerary/EditorialItinerary.tsx` | Call `useTripVenueBank(days)` and pass the result to `EditActivityModal`. |

### Feature 2: User Photo Upload/Swap on Activity Cards

**Concept**: Let users upload their own photo for any activity, replacing the auto-fetched one. Add a camera/image icon overlay on the activity thumbnail that opens a file picker. The uploaded photo is stored in the existing `trip-photos` storage bucket and the URL is written back to the activity's `image_url` field.

**How it works**:
- On hover/tap of the activity thumbnail, show a small camera icon button.
- Clicking it opens a file input (JPEG/PNG/WebP, max 5MB).
- Upload to `trip-photos` bucket at path `{userId}/{tripId}/activity_{activityId}_{timestamp}.jpg`.
- Update the activity in state with the new `image_url` and `photos` array, which triggers the existing save pipeline.
- No credit cost for uploading your own photo (it's your storage).
- No new database tables needed — uses existing `trip-photos` bucket and the activity's `image_url` field in `itinerary_data`.

**Files to change**:
| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/EditorialItinerary.tsx` | In the `ActivityCardContent` component, add a photo overlay button on the thumbnail. On click, trigger a hidden file input. On file selected, upload to storage, then call `handleUpdateActivity` to set `image_url` on the activity. |
| 2 | `src/components/itinerary/EditActivityModal.tsx` | Add a "Change Photo" section at the top of the modal with a thumbnail preview and upload button, so users can also swap photos from the edit dialog. |

### Summary
- **Venue Bank**: Zero backend changes. Purely in-memory derived from existing trip data. ~150 lines of new code across 3 files.
- **Photo Upload**: Uses existing `trip-photos` bucket and storage infrastructure. ~100 lines of new code. No credit cost.

