

## Plan: Fix Checkout Overlay Navbar Bleed

**File: `src/components/checkout/EmbeddedCheckoutModal.tsx`**

Two changes:

1. **Line 94** — Make overlay fully opaque: replace `bg-background/95 backdrop-blur-sm` with `bg-background` (removes transparency that lets navbar bleed through)

2. **Lines 98-109** — Restyle header with checkout identity: add credit card icon, split "Complete your purchase" title from product name subtitle, increase padding to `px-6 py-4`, mute the close button icon color

