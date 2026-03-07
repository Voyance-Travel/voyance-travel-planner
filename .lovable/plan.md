

## Fix 24 — Revert GenerationAnimation to Original Globe

The current `GenerationAnimation.tsx` has a compass + orbiting plane design. The user wants to replace it entirely with the original clean globe animation they've provided verbatim.

### Plan

**Single file change:** Replace the entire contents of `src/components/planner/shared/GenerationAnimation.tsx` with the exact code the user provided — a wireframe globe with SVG ellipse lat/long lines, orbiting plane, contrail particles, progress-based pin markers, and pulsing ring.

No other files need to change. The component's props interface (`progress`, `className`) remains identical, so all consumers work without modification.

