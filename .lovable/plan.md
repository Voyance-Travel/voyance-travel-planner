

## Fix: Remove Duplicate Camera Button

### Changes

**1. `src/pages/ActiveTrip.tsx` (~line 1007)**
Remove `onMediaPress` prop from `InlineActivityRating`:
```tsx
<InlineActivityRating
  activityId={activity.id}
  tripId={trip.id}
  activityType={activity.type}
  activityCategory={activity.category}
  destination={trip.destination}
  existingRating={feedbackByActivity.get(activity.id) as any || null}
  onVoicePress={() => onVoicePress(activity.id, activity.name)}
  compact
/>
```

**2. `src/components/feedback/InlineActivityRating.tsx`**
- Remove `onMediaPress` from props interface and the Camera button from the media buttons section
- Restyle the voice button to show "Note" label next to the mic icon:
```tsx
{onVoicePress && (
  <div className="flex items-center ml-1 border-l border-border/50 pl-1">
    <button onClick={onVoicePress} className="flex items-center gap-1 px-2 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all text-xs">
      <Mic className="w-3.5 h-3.5" />
      <span>Note</span>
    </button>
  </div>
)}
```
- Remove `Camera` from lucide imports

Result layout: `🤩 👍 😐 👎 | 🎤 Note` ... then `📷 MemoryUploadButton` stays separate in the action buttons row.

