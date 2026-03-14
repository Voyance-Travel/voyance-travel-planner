

## Fix: SVG `<circle>` attribute "undefined" errors in GenerationAnimation

**Root cause**: Framer Motion's `motion.circle` with animated SVG attributes (`r`, `cx`, `cy`) can briefly produce `undefined` values during animation initialization. Two specific issues:

1. **Pulse rings & background glow** (lines 57-78): Animating `r` as a keyframe array (`r: [52, 72]`) — framer-motion may set `r` to `undefined` before the first frame renders.
2. **Floating particles** (lines 134-152): Using `scale` on an SVG `<circle>` — framer-motion tries to apply CSS transforms to SVG attributes, which can produce undefined `r` values. SVG circles don't support CSS `scale` the same way HTML elements do.

### Fix in `src/components/planner/shared/GenerationAnimation.tsx`

| Element | Change |
|---------|--------|
| Pulse ring 1 (line 57) | Add `initial={{ r: 52, opacity: 0.4 }}` |
| Pulse ring 2 (line 64) | Add `initial={{ r: 52, opacity: 0.3 }}` |
| Background glow (line 73) | Add `initial={{ r: 48, opacity: 0.06 }}` |
| Floating particles (line 134) | Replace `scale: [0.5, 1, 0.5]` with `r: [1, 2, 1]` (animate the radius directly instead of using CSS scale on SVG), and add `initial={{ cy: cy, opacity: 0, r: 1 }}` |

Single file edit. All changes are adding explicit `initial` props and replacing incompatible `scale` with native SVG `r` animation.

