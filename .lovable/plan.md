

## Fix: Shrink oversized mobile inputs in Flight & Hotel step

### Problem
In `src/pages/Start.tsx`, several form inputs in the Flight & Hotel step use the default Input component sizing (`h-10`, `text-base` on mobile), making them look chunky. The flight date/time inputs already have `text-xs h-8` but the hotel section inputs do not. The `type="date"` and `type="time"` native inputs render especially large on mobile without explicit size constraints.

### Changes — all in `src/pages/Start.tsx`

**1. Hotel check-in/out TIME inputs (lines ~1891-1905)** — Add `text-xs h-8` class to both:
- Line 1895: `className="w-full"` → `className="text-xs h-8 w-full"`
- Line 1904: `className="w-full"` → `className="text-xs h-8 w-full"`

**2. Hotel check-in/out DATE inputs (lines ~1914-1930)** — Add `text-xs h-8`:
- Line 1914-1920: Add `className="text-xs h-8"` to check-in date Input
- Line 1924-1930: Add `className="text-xs h-8"` to check-out date Input

**3. Hotel name, address, neighborhood inputs (lines ~1857-1885)** — Add `text-xs h-8`:
- Line 1857-1861: Hotel name Input — add `className="text-xs h-8"`
- Line 1872-1876: Address Input — add `className="text-xs h-8"`
- Line 1881-1885: Neighborhood Input — add `className="text-xs h-8"`

**4. Hotel price input (line ~1941-1948)** — Add `text-xs h-8`:
- `className="pl-9"` → `className="pl-9 text-xs h-8"`

**5. Accommodation type selector label sizes (lines ~1817-1831)** — Already `text-xs`, no change needed.

This makes every input in the hotel modal match the compact `text-xs h-8` sizing already used by the flight inputs (Departs, Arrives, Date, Airline, Flight #).

