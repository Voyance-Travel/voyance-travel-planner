

## Bug Fix: Notification X Button Not Removing Notifications

### Root Cause
The dismiss (X) button calls `dismissMutation.mutate()` which marks the notification as `read: true, sent: true` in the database, then invalidates the query cache. However, the refetched query **still returns the same notifications** because `getDbNotifications` fetches all notifications regardless of read status, and `getEdgeFunctionNotifications` also returns them. The notification stays visible — it just loses its "unread" styling.

The user expects clicking X to **remove** the notification from the list, not just mark it as read.

### Fix (2 parts)

**1. Optimistic cache update in `useDismissNotification`** (`src/services/tripNotificationsAPI.ts`)
- In the `useDismissNotification` hook, add `onMutate` to optimistically remove the dismissed notification from the `['user-notifications', userId]` query cache immediately on click
- Add `onError` rollback to restore the previous cache if the mutation fails

**2. Filter dismissed notifications in `NotificationBell.tsx`**
- After the dismiss mutation succeeds and the query refetches, dismissed notifications will still come back from the DB (since we query all). Add a local `dismissedIds` state set that tracks IDs dismissed in the current session, and filter them out of the rendered list. This provides instant visual removal without waiting for refetch, and handles the case where the backend still returns them.

### Alternative considered
Changing the DB query to exclude `read = true` notifications would hide ALL read notifications permanently, which may not be desired (users might want to see recent read notifications). The local dismissal tracking is more precise.

