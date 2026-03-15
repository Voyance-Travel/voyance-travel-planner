

# Observability & Session Debugging Improvements

## Current State Summary
You have solid foundations: page_events tracking, an admin UserTracking dashboard, audit logs, and cost tracking. But there are key gaps that make it hard to answer "what happened to this specific user?"

## What to Build

### 1. User Session Drilldown (Admin)
Add a "Session Explorer" view to the admin area where you can:
- Search by user email or user_id
- See their chronological session timeline: every page view, interaction, and error — in order
- Click a session to see the full sequence of events with timestamps, scroll depths, and time spent

**Files:** New `src/pages/admin/SessionExplorer.tsx`, add route in `App.tsx`

### 2. Client-Side Error Tracking to Database
Capture unhandled errors and promise rejections, write them to a new `client_errors` table. This lets you see in the admin panel what errors users are actually hitting in production.

**Changes:**
- New DB table: `client_errors` (user_id, session_id, error_message, stack_trace, page_path, created_at)
- New `src/hooks/useErrorTracker.ts` — listens to `window.onerror` and `unhandledrejection`, writes to the table
- Mount in App.tsx alongside `useAnalyticsTracker`

### 3. Funnel Visualization
Add a funnel view to the existing UserTracking dashboard showing conversion through key paths:
- Landing → Sign Up → Quiz Complete → Trip Created → Itinerary Generated
- Uses existing `page_events` data, just needs the visualization component

**Files:** New `src/components/admin/FunnelChart.tsx`, integrate into `UserTracking.tsx`

### 4. Surface Interaction Events in Admin
The `trackInteraction()` function already exists and writes CTA clicks to `page_events`. The admin dashboard currently filters only `page_view`/`page_exit`. Add a "CTA Clicks" tab showing which buttons users click most (element_id, element_text, count).

**Files:** Update `UserTracking.tsx` to add an interactions section

## DB Migration
```sql
CREATE TABLE public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  error_message text NOT NULL,
  stack_trace text,
  page_path text,
  component_name text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated or anon user to insert their own errors
CREATE POLICY "Anyone can insert errors"
  ON public.client_errors FOR INSERT
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can read errors"
  ON public.client_errors FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
```

## Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/SessionExplorer.tsx` | New — user session drilldown with timeline view |
| `src/hooks/useErrorTracker.ts` | New — captures unhandled errors to `client_errors` table |
| `src/components/admin/FunnelChart.tsx` | New — funnel visualization component |
| `src/pages/admin/UserTracking.tsx` | Add CTA clicks tab and funnel section |
| `src/App.tsx` | Add SessionExplorer route, mount useErrorTracker |
| DB migration | Create `client_errors` table with RLS |

## Priority Order
1. **Error tracking** (most impactful for debugging "unexpected results")
2. **Session Explorer** (lets you trace exactly what a user did)
3. **CTA clicks in admin** (quick win, data already exists)
4. **Funnel visualization** (nice-to-have, helps with conversion analysis)

