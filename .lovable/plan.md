

## Enhancement: PersonalizationProof CTA Reorder

**File: `src/components/home/PersonalizationProof.tsx`** (lines 383-409)

Replace the current CTA block with:

1. **"Explore our 29 types"** link (navigating to archetypes page) — shown first
2. **"Discover Your Travel DNA"** quiz link — shown below, no decorative dashes
3. **"5-minute quiz. No account required."** text — tight underneath, reduce `mt-10` to `mt-6` to eliminate whitespace gap

No decorative line dividers around "Travel DNA". Change "archetypes" → "types" in this CTA. Remove the large button variant on desktop (keep both as simple text links for consistency) or keep the button but reorder.

### Exact changes (lines 383–409):

```tsx
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
  transition={{ delay: 0.2 }}
  className="mt-6 text-center space-y-2"
>
  <button
    onClick={() => navigate(ROUTES.ARCHETYPES)}
    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
  >
    Explore our 29 types
    <ArrowRight className="h-4 w-4" />
  </button>
  <div>
    <Button 
      size="lg" 
      className="hidden sm:inline-flex gap-2 rounded-full px-8"
      onClick={() => navigate(ROUTES.QUIZ)}
    >
      Discover Your Travel DNA
      <ArrowRight className="h-4 w-4" />
    </Button>
    <button
      onClick={() => navigate(ROUTES.QUIZ)}
      className="sm:hidden inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
    >
      Discover Your Travel DNA
      <ArrowRight className="h-4 w-4" />
    </button>
    <p className="text-xs text-muted-foreground mt-1.5">
      5-minute quiz. No account required.
    </p>
  </div>
</motion.div>
```

**1 file changed.** Desktop-only visual change, no data/logic impact.

