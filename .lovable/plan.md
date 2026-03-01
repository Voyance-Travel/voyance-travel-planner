

# Add Accessibility Section to Settings Page

## Problem
The accessibility settings (Larger Text, High Contrast, Reduced Motion, Differentiate Without Color) are only accessible via the small accessibility icon in the header navigation bar. They don't appear anywhere on the main Settings page, which is where users naturally look for configuration options.

## Solution
Add a new "Accessibility" card section to the Settings page (`src/pages/Settings.tsx`) between the Notifications and Linked Accounts sections. This card will use the same `useAccessibilityStore` hook that already powers the header panel, so both locations stay in sync automatically.

## Changes

### File: `src/pages/Settings.tsx`

1. **Add imports**: Import `Accessibility`, `Type`, `Eye`, `Zap`, `Palette` from lucide-react, and import `useAccessibilityStore` from the store.

2. **Wire up the store**: Call `useAccessibilityStore()` at the top of the component to get the four toggles and their setters.

3. **Add new card section** (after the Notifications card, around line 525): Insert a new `motion.div` with a Card containing four toggle rows:
   - **Larger Text** (Type icon) -- "Increase base font size for easier reading"
   - **High Contrast** (Eye icon) -- "Increase color contrast for better visibility"
   - **Reduced Motion** (Zap icon) -- "Minimize animations and transitions"
   - **Differentiate Without Color** (Palette icon) -- "Add patterns and underlines so color isn't the only indicator"

   Each row follows the exact same layout pattern already used in the Notifications section: label + description on the left, Switch toggle on the right, separated by `Separator` components.

4. **Note at bottom of card**: Small muted text: "These preferences are saved locally and persist across sessions."

### No other files need changes
- The `useAccessibilityStore` already persists to localStorage
- The `useAccessibilityClasses` hook already syncs classes to the HTML root
- The header panel (`AccessibilitySettingsPanel`) stays as-is for quick access -- both locations read/write the same store, so they're always in sync

## Result
Users will see an "Accessibility" section on the Settings page with the same four toggles available from the header icon. Changing a toggle in either location updates both instantly since they share the same Zustand store.
