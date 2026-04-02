# Itinerary Generation System - Source of Truth v2.1 (ACTUAL)

**Last Updated**: 2025-12-14
**Status**: Production Reality
**Version**: 2.1 (Corrected from 2.0)

---

## ⚠️ CORRECTION NOTICE

**v2.0 documented aspirational features that don't exist.** This v2.1 corrects that.

**What Changed**:

- Removed WebSocket claims (never implemented)
- Documented actual job queue system
- Corrected status values to match code
- Removed 15-minute auto-reset claim (not implemented)
- Fixed table count (5, not 6)

If you read v2.0, disregard WebSocket and progressive generation sections.

---

## OVERVIEW

The itinerary generation system creates personalized day-by-day travel itineraries using OpenAI GPT-4. This document describes **what actually exists in production**, verified by backend and frontend code audits.

**Architecture**: Job queue with HTTP polling (NOT WebSockets)

---

## SYSTEM ARCHITECTURE (ACTUAL)

### Core Components

1. **Itinerary Chain Generator** ([itinerary-chain-generator.ts](../src/services/itinerary-chain-generator.ts))
   - Orchestrates multi-day itinerary generation
   - Batches days for parallel OpenAI calls (3 days per batch)
   - Saves raw responses immediately after each batch
   - Updates job queue progress
   - NO WebSocket events (v2.0 error)

2. **Job Queue Service** ([itinerary-job-queue.ts](../src/services/itinerary-job-queue.js))
   - Manages async generation jobs
   - Tracks job state: "waiting" → "active" → "completed"/"failed"
   - Provides progress estimates
   - Stores job ID in `trips.metadata->itineraryGenerationJobId`

3. **Incremental Save Service** ([itinerary-incremental-save.ts](../src/services/itinerary-incremental-save.ts))
   - Saves raw OpenAI responses to 5 tables (not 6 - v2.0 error)
   - Enables cost tracking and failure recovery
   - Invisible to frontend

4. **Itinerary Routes** ([itinerary.ts](../src/routes/itinerary.ts))
   - GET /trips/:tripId/itinerary - Retrieve or check status
   - POST /trips/:tripId/itinerary/generate-now - Start async job
   - NO `/generate-ws` endpoint (v2.0 error)

---

## DATA STORAGE STRATEGY (ACTUAL)

### Priority 1: Atomic Save to trips.metadata

All completed itineraries saved to `trips.metadata->itinerary` as JSONB.

**This is the primary data source frontend sees.**

Structure:

```typescript
{
  days: Array<{
    dayNumber: number;
    date: string;
    title?: string;
    theme?: string;
    activities: Activity[];
    meals?: MealPlan;
  }>;
  destination: string;
  title: string;
  startDate: string;
  endDate: string;
  travelers: number;
  generatedAt: string;
}
```

### Priority 2: Incremental Saves (5 Tables, Not 6)

Each day saved immediately to track progress:

1. **trip_itineraries** ✅
   - Day-level data + raw OpenAI response in `description`
   - Unique constraint: (trip_id, day_number)

2. **trip_activities** ❌ SKIPPED
   - v2.0 claimed this was saved incrementally
   - **Reality**: Only populated AFTER generation completes
   - Code comment: "Will be populated by comprehensive save"

3. **itinerary_snapshots** ✅
   - Versioned backups (version="current")
   - Unique constraint: (trip_id, version)

4. **itinerary_days** ✅
   - Day metadata and time slots

5. **itinerary_slots** ✅
   - Raw OpenAI response per time slot

6. **itinerary_cache** ✅
   - Reusable content for similar trips

**Actual Count**: 5 tables written incrementally (skip trip_activities)

**Code Evidence** ([itinerary-incremental-save.ts:500](../src/services/itinerary-incremental-save.ts#L500)):

```typescript
console.log("💾 [ALL TABLES] Saving RAW data to ALL FOUR TABLES", {
  // ^ Comment says "FOUR" but actually saves to 5
```

---

## GENERATION FLOW (ACTUAL)

### Step-by-Step Process

1. **POST /trips/:tripId/itinerary/generate-now**
   - Validate trip exists and user owns it
   - Check not already generating
   - Create job in queue
   - Store job ID in `trips.metadata->itineraryGenerationJobId`
   - Return 202 Accepted + job ID
   - **NO WebSocket channel returned** (v2.0 error)

2. **Job Processes in Background**
   - Pulls trip data from database
   - Calls OpenAI in batches (3 days at a time)
   - Saves raw responses via `saveRawToAllTables()`
   - Updates job progress estimate
   - **NO WebSocket events sent** (v2.0 error)

3. **Frontend Polls GET Endpoint**
   - Every 5 seconds (recommended)
   - GET endpoint returns job status + progress
   - Max 15 minutes (180 × 5s)
   - **Polling is REQUIRED** (no alternative)

4. **Comprehensive Save on Completion**
   - Format days for frontend
   - Save to `trips.metadata->itinerary`
   - Populate `trip_activities` table
   - Mark job as "completed"
   - Remove job ID from metadata

5. **Frontend Gets Final Result**
   - Next poll returns status="ready"
   - Full itinerary in response
   - Frontend stops polling

---

## RETRIEVAL FLOW (GET ENDPOINT)

Checks sources in priority order:

### STEP 1: Check trips.metadata->itinerary

```typescript
if (metadata.itinerary && metadata.itinerary.days.length > 0) {
  return { status: "ready", itinerary: metadata.itinerary };
}
```

**Safeguard**: Detects broken state (empty days array)

### STEP 2: Check trip_itineraries Table

```sql
SELECT ti.*, json_agg(ta.*) as activities
FROM trip_itineraries ti
LEFT JOIN trip_activities ta ON ta.itinerary_id = ti.id
WHERE ti.trip_id = $1
GROUP BY ti.id
ORDER BY ti.day_number
```

Returns itinerary from incremental saves.

### STEP 3: Check itinerary_snapshots Table

```sql
SELECT snapshot
FROM itinerary_snapshots
WHERE trip_id = $1 AND version = 'current'
```

Returns last snapshot.

### STEP 4: Check Job Status

```typescript
if (metadata.itineraryGenerationJobId) {
  const job = await jobQueue.getJobStatus(jobId);

  if (job.state === "waiting") {
    return { status: "queued", progress: 0 };
  } else if (job.state === "active") {
    return { status: "running", progress: job.progress };
  }
}
```

**Returns job progress if still processing.**

**Note**: NO 15-minute auto-reset here (v2.0 error)

### STEP 5: Return not_started

```typescript
return {
  success: true,
  hasItinerary: false,
  status: "not_started", // ⚠️ Missing in code (bug)
  itinerary: null,
};
```

**Bug**: Code omits `status` field in this response.

---

## STATUS VALUES (ACTUAL)

All responses should include `status` field:

| Status        | Code       | Meaning             | Job State | Frontend Action |
| ------------- | ---------- | ------------------- | --------- | --------------- |
| `ready`       | ✅ Used    | Complete            | N/A       | Display         |
| `not_started` | ⚠️ Omitted | Never generated     | N/A       | Show button     |
| `queued`      | ✅ Used    | Waiting to start    | "waiting" | Poll            |
| `running`     | ✅ Used    | Actively generating | "active"  | Poll + progress |
| `failed`      | ✅ Used    | Generation failed   | "failed"  | Error + retry   |

**v2.0 Error**: Documented "generating" but code uses "running"

**Bug**: STEP 5 doesn't return status field ([itinerary.ts:658](../src/routes/itinerary.ts#L658))

---

## SAFEGUARDS (ACTUAL)

### 1. Empty Days Detection ✅ IMPLEMENTED

```typescript
if (!days || !Array.isArray(days) || days.length === 0) {
  logger.warn("Broken state: has itinerary but 0 days");
  // Fall through to next step
}
```

**Works**: Prevents showing blank page.

### 2. Stuck Generation Auto-Reset ❌ NOT IMPLEMENTED

**v2.0 Claimed**: Auto-reset after 15 minutes in GET endpoint

**Reality**: NOT in code. No timeout detection. No auto-reset logic.

**Actual Timeout Mechanisms**:

1. HTTP request timeout (5 minutes)
2. Job queue timeout (implementation dependent)
3. Frontend polling timeout (15 minutes client-side)

**Impact**: Jobs can get stuck in "running" state forever without manual intervention.

### 3. Incremental Saves ✅ IMPLEMENTED

```typescript
await itineraryIncrementalSaveService.saveRawToAllTables(
  tripId,
  dayNumber,
  dayDate,
  rawOpenAIResponse,
);
```

**Works**: Called after each batch, saves to 5 tables.

**Non-Fatal**: Continues generation even if save fails.

---

## FRONTEND REALITY

### Progressive Generation is Simulated

**What Happens**:

1. Frontend tries `/generate-progressive` → 404
2. Falls back to `/generate-now`
3. **Simulates** progressive UI locally
4. Shows fake messages: "Creating Day 3 of 8..."
5. Actually just polling with estimated progress

**Note (2025-04):** The `useProgressiveItinerary.ts` hook referenced here was removed as dead code.
Generation is now handled by `TripDetail.tsx` calling the `generate-itinerary` edge function with
`action: 'generate-trip'`, with progress tracked via `useGenerationPoller.ts`.

**User Experience**: Progress is tracked via database polling (heartbeat + completed day count).

**Backend Reality**: Opaque job processing, only final result visible.

---

## ERROR HANDLING & FAILURES

### 1. OpenAI API Failure

**What Happens**:

- Job marked as "failed"
- Error message stored
- No partial data saved to metadata
- Incremental saves preserved (in 5 tables)

**Frontend Sees**:

```json
{
  "status": "failed",
  "lastError": "OpenAI API timeout"
}
```

### 2. Database Save Failure

**During Incremental Save**:

- Error logged but non-fatal
- Generation continues
- May lose some tracking data

**During Comprehensive Save**:

- Job marked as "failed"
- User must retry

### 3. Job Queue Crash

**If Job Queue Dies**:

- Job state lost
- Trip stuck with `itineraryGenerationJobId` pointing to dead job
- **Manual fix required**:
  ```sql
  UPDATE trips
  SET metadata = metadata - 'itineraryGenerationJobId'
  WHERE id = 'trip-id';
  ```

---

## PERFORMANCE (MEASURED)

### Generation Times

**Production Data**:

- 3-5 days: 20-45 seconds
- 7-8 days: 45-90 seconds
- 10+ days: 90-180 seconds

**Variables**:

- OpenAI API latency (2-8s per batch)
- Batch size (3 days)
- Database save time (<500ms)
- Job queue overhead

### Polling Overhead

**15 Minute Generation**:

- 180 polls × ~300ms = 54 seconds total polling time
- Negligible compared to generation time
- Recommended: 5 second intervals

---

## WHAT DOESN'T EXIST

### Features Documented in v2.0 But Never Built

1. **WebSocket Support**
   - No WebSocket server
   - No `/generate-ws` endpoint
   - No event handlers
   - No `channel` or `wsUrl` fields

2. **WebSocket Events**
   - No `generation.started`
   - No `generation.progress`
   - No `generation.completed`
   - No `generation.failed`

3. **Progressive Endpoint**
   - `/generate-progressive` returns 404
   - No partial data sent
   - No template at 50%

4. **15-Minute Auto-Reset**
   - No detection in GET endpoint
   - No automatic status change
   - Jobs can stuck forever

5. **6 Tables**
   - v2.0 claimed 6 tables
   - Actually saves to 5
   - Skips trip_activities during incremental save

---

## TROUBLESHOOTING (ACTUAL)

### "Itinerary page shows blank"

**Diagnosis**:

```sql
SELECT
  metadata->'itinerary'->'days' as days,
  array_length((metadata->'itinerary'->'days')::json::text::json[], 1) as count
FROM trips
WHERE id = $1;
```

**Fix**: Reset to not_started

```sql
UPDATE trips
SET metadata = metadata - 'itinerary'
WHERE id = $1;
```

### "Generation stuck at X%"

**Diagnosis**:

```sql
SELECT
  metadata->'itineraryGenerationJobId' as job_id,
  created_at,
  NOW() - created_at as age
FROM trips
WHERE id = $1;
```

**Fix**: Remove dead job ID

```sql
UPDATE trips
SET metadata = metadata - 'itineraryGenerationJobId'
WHERE id = $1;
```

**Note**: NO automatic reset exists.

### "Status returns undefined"

**Cause**: Bug in STEP 5 response (line 658)

**Workaround**: Frontend should treat missing status as "not_started"

---

## DATABASE SCHEMA FIXES APPLIED

### Completed (2025-12-14)

1. ✅ Added unique constraint to trip_itineraries

   ```sql
   ALTER TABLE trip_itineraries
   ADD CONSTRAINT unique_trip_day UNIQUE (trip_id, day_number);
   ```

2. ✅ Fixed itinerary_snapshots versioning
   - Old: `v${Date.now()}` (infinite growth)
   - New: `"current"` (single row per trip)

3. ✅ Added title/description to FrontendDay interface

---

## API CONTRACT

**Official Contract**: `ITINERARY_GENERATION_CONTRACT_v1.1_ACTUAL.md`

**Supersedes**: v1.0 (contained errors)

---

## MIGRATION HISTORY

### v2.1 (2025-12-14) - Correction to Reality

**Fixed Documentation**:

- Removed WebSocket claims (never existed)
- Added job queue system
- Corrected status values
- Fixed table count (5, not 6)
- Removed auto-reset claim
- Documented frontend simulation

**No Code Changes**: Code was always correct, docs were wrong.

### v2.0 (2025-12-14) - Aspirational (RETRACTED)

**Errors in v2.0**:

- Documented WebSocket features that don't exist
- Claimed `/generate-ws` endpoint
- Wrong status values
- Wrong table count
- False auto-reset claim

**Why Happened**: Documentation created from desired state, not actual code.

### v1.0 (Before 2025-11-09) - Original

**Issues**:

- Only saved to metadata
- No incremental saves
- No status field
- 2-week outage (no NEON saves)

---

## DECISION NEEDED

### Current State

**Working System**:

- ✅ Generation works
- ✅ Polling works
- ✅ Incremental saves work
- ✅ Frontend gracefully simulates features

**Documentation Mismatch**:

- ❌ Claimed WebSockets (don't exist)
- ❌ Claimed progressive endpoint (doesn't exist)
- ❌ Claimed auto-reset (doesn't exist)

### Options

**Option A: Build Missing Features**

- Implement WebSockets
- Add `/generate-ws` endpoint
- Build progressive data sending
- Add auto-reset logic
- **Effort**: 2-3 weeks

**Option B: Accept Current System**

- Update all docs to match reality
- Frontend already has good fallbacks
- Users happy with current UX
- **Effort**: Complete (this document)

**Option C: Hybrid**

- Keep polling architecture
- Add real progressive data (not simulated)
- Add auto-reset to GET endpoint
- **Effort**: 1 week

---

## CONCLUSION

**The system works**. Generation succeeds, users get itineraries, frontend handles edge cases gracefully.

**The documentation was aspirational**. v2.0 described features we wanted, not what exists.

**This v2.1 is accurate**. Matches actual backend code and frontend behavior.

**Recommendation**: Accept current architecture (Option B), focus on other priorities.

---

**AUTHORITATIVE STATUS**: ✅ **MATCHES PRODUCTION**

This document accurately describes what exists in production as of 2025-12-14, verified by:

- Backend code audit
- Frontend code audit
- Production testing

**Related Documents**:

- API Contract: `ITINERARY_GENERATION_CONTRACT_v1.1_ACTUAL.md`
- Audit Report: `AUDIT_SOT_VS_IMPLEMENTATION_2025-12-14.md`
- Frontend Audit: (User-provided)
