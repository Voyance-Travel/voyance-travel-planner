

## Fix: 4xx Treated as Success in Day-Chain

**Problem**: Two locations in `generate-itinerary/index.ts` use `response.ok || response.status < 500` which treats 4xx errors (403, 400, 404) as success, silently killing the generation chain.

**Changes** — single file: `supabase/functions/generate-itinerary/index.ts`

### Location 1: Initial chain call (line 10417)

Replace `if (response.ok || response.status < 500) break;` with:
```typescript
if (response.ok) break;
const respText = await response.text().catch(() => '(no body)');
console.error(`[generate-trip] Initial chain attempt ${attempt}/${maxRetries} returned ${response.status}: ${respText.slice(0, 200)}`);
if (response.status >= 400 && response.status < 500) {
  console.error(`[generate-trip] Client error ${response.status} — not retrying`);
  break;
}
```

### Location 2: Day-to-day chain call (lines 10872-10875)

Replace:
```typescript
if (response.ok || response.status < 500) {
  chainSuccess = true;
  break;
}
```
With:
```typescript
if (response.ok) {
  chainSuccess = true;
  break;
}
const respText = await response.text().catch(() => '(no body)');
console.error(`[generate-trip-day] Chain attempt ${attempt}/${maxRetries} returned ${response.status}: ${respText.slice(0, 200)}`);
if (response.status >= 400 && response.status < 500) {
  console.error(`[generate-trip-day] Client error ${response.status} — not retrying`);
  break;
}
```

This ensures 4xx errors are logged and immediately break the retry loop (they won't succeed on retry), 5xx errors still retry with backoff, and failed chains correctly write error metadata so the frontend can detect and recover.

