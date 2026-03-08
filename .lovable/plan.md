

## Fix: Voice Notes — Playback in Memories Timeline and Activity Cards

### Problem
Voice notes are uploaded to storage (`trip-photos` bucket) and referenced in `activity_feedback` with `has_voice_note` tag, but there's no UI to list or play them back.

### Approach
Two changes: (1) a Voice Notes section in the Memories tab, and (2) inline playback indicators on activity cards in the Today view.

---

### 1. New component: `VoiceNotesList`

**File: `src/components/memories/VoiceNotesList.tsx`** (new)

A component that:
- Takes `tripId` as prop
- Fetches `activity_feedback` rows for the trip where `personalization_tags` contains `has_voice_note`
- For each, lists the voice files from storage using `supabase.storage.from('trip-photos').list()` scoped to `{userId}/{tripId}/{activityId}/` filtering for `voice_` prefix
- Generates signed URLs and renders `<audio controls>` players
- Shows activity name, duration (from `feedback_text`), and a delete button
- Wrapped in a React Query hook for caching

### 2. Integrate into MemoriesTimeline

**File: `src/components/memories/MemoriesTimeline.tsx`**

- Import and render `<VoiceNotesList tripId={tripId} />` after the photo grid sections
- Add a "Voice Notes" header with `Mic` icon
- Update the empty state to mention both photos and voice notes

### 3. Inline voice note indicator on activity cards

**File: `src/pages/ActiveTrip.tsx`**

After the `InlineActivityRating` component for each activity, check if the feedback has `has_voice_note` tag. If so, show a small playback row:
- `Mic` icon + "Voice note" label + a Play button
- On Play: fetch the voice file from storage (`trip-photos` bucket), generate a signed URL, and open an inline `<audio>` player
- This requires enhancing `feedbackByActivity` to store the full feedback object (not just the rating string) so we can check `personalization_tags`

### 4. Enhance feedbackByActivity map

**File: `src/pages/ActiveTrip.tsx`** (~line 308)

Change from `Map<string, string>` (activity_id → rating) to `Map<string, { rating: string; personalization_tags?: string[] }>` so the voice note tag is accessible in the template. Update the `DayView` props interface accordingly.

---

### Technical notes
- Voice files are in bucket `trip-photos` at path `{userId}/{tripId}/{activityId}/voice_*.webm`
- Signed URLs (1 hour) are needed since the bucket is private
- The `VoiceNotesList` component will use `supabase.storage.from('trip-photos').list()` to discover files, then `createSignedUrl()` for playback
- Native `<audio>` element handles `.webm` playback in all modern browsers

