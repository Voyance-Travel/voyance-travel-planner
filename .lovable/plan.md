

## Fix: Green Focus Box Around Inputs

### Problem
Line 152-154 in `src/index.css` applies a **global** focus ring to every focusable element:
```css
*:focus-visible {
  @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background;
}
```
The `--ring` CSS variable is set to a teal/green hue (`185 45% 28%`), creating a visible green box around inputs when typing.

This is **redundant** — individual components like `Input`, `Button`, `Select`, etc. already define their own `focus-visible:ring-2 focus-visible:ring-ring` styles via Tailwind classes. The global rule doubles up and creates an aggressive green outline on everything.

### Fix
**File: `src/index.css` (lines 151-154)**

Remove the global `*:focus-visible` rule entirely. All shadcn/ui components already handle their own focus styles. The high-contrast accessibility override on line 343 (`html.a11y-high-contrast *:focus-visible`) can stay — it only activates when users explicitly enable high contrast mode.

This is a 3-line deletion. No other files need changes.

