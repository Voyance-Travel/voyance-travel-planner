

## Fix: Desktop Hero Sky Color Consistency

**Problem**: The gradient overlay on the hero differs between mobile and desktop. On mobile, `bg-gradient-to-t from-black/70 via-black/30 to-black/20` preserves the light blue sky at the top. On desktop, `md:bg-black/40` applies a uniform dark overlay that mutes the sky to gray.

**Fix**: Single file change in `src/components/home/ValueFirstHero.tsx` line 24.

Replace the overlay div class so desktop also uses a gradient that's light at the top (preserving sky blue) while still darkening the bottom for text readability:

```
// Before:
bg-gradient-to-t from-black/70 via-black/30 to-black/20 md:bg-black/40

// After:
bg-gradient-to-t from-black/70 via-black/30 to-black/10
```

This removes the desktop-specific flat overlay (`md:bg-black/40`) and uses a single gradient for all breakpoints — dark at the bottom for text contrast, nearly transparent at the top to let the light blue sky show through on both mobile and desktop.

