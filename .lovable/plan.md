
# The Living Site System
## Making Voyance Feel Alive Without Breaking What Works

---

## Executive Summary

This plan adds an interactive, responsive layer to Voyance that makes every user action feel acknowledged. The site will notice cursor movement, respond to scrolling, guide navigation intelligently, and provide warm feedback at every step. All changes are **additive** - we're enhancing existing components, not replacing them.

---

## Current State Analysis

### What Already Exists (Don't Break These)
- **CompanionContext** - State-aware messaging system (stranger → loyal)
- **useCompanionFeedback** - Micro-feedback hooks for actions
- **QuizFeedback** - Inline answer acknowledgments
- **TripSetupFeedback** - Destination/date responses
- **PersonalizedLoadingProgress** - Context-aware loading messages
- **BrowseNudge** - Session-aware floating prompts
- **Framer Motion** - Already installed and used throughout

### Missing Components
- No magnetic buttons or cursor awareness
- No page transitions between routes
- No scroll-based progress indicators
- No journey tracking across pages
- No contextual help system
- Loading states are component-specific, not system-wide

---

## Implementation Plan

### System 1: Cursor & Hover Awareness

**New Components:**

```text
src/components/ui/
├── magnetic-button.tsx      # Buttons that reach toward cursor
├── interactive-card.tsx     # Cards with progressive hover reveals
└── cursor-glow.tsx          # Subtle ambient cursor glow
```

**MagneticButton** - Wraps existing Button for primary CTAs
- Uses `onMouseMove` to track cursor position relative to button center
- Applies subtle transform (15% of cursor delta) using framer-motion
- Springs back on mouse leave
- Usage: Replace `<Button>` with `<MagneticButton>` on key CTAs

**InteractiveCard** - Enhanced card with hover reveal
- Shows preview text normally
- On hover: Fades preview, reveals full content + CTA
- Subtle lift animation (translateY: -4px)
- Internal glow effect with accent color

**CursorGlow** - Global ambient effect (optional, performance-gated)
- 256px gradient circle follows cursor with spring physics
- Only renders on desktop (media query)
- 3% opacity teal radial gradient
- Mounted once in App.tsx

---

### System 2: Scroll-Based Storytelling

**New Components:**

```text
src/components/common/
├── scroll-reveal.tsx        # Wrapper for progressive content reveal
├── story-progress.tsx       # Right-side scroll progress indicator
└── parallax-layer.tsx       # Depth effect for hero sections
```

**ScrollReveal** - Progressive content appearance
- Uses `useInView` from framer-motion with margin="-100px"
- Animates opacity (0→1) and y (30→0) with staggered delays
- Already partially implemented inline; this extracts to reusable component

**StoryProgress** - Desktop-only section navigator
- Fixed right position, vertically centered
- Shows section dots with labels on hover
- Highlights current section based on scroll position
- Click to jump to section
- Pages with scroll stories: Home, HowItWorks, Archetypes

**ParallaxLayer** - Subtle depth on hero sections
- Wrapper that moves content at different scroll speeds
- `speed` prop: 0.2 (slow bg), 0.4 (mid elements), 1.0 (content)
- Uses `useTransform` with scroll progress

---

### System 3: Page Transitions

**New Component:**

```text
src/components/layout/
└── page-transition.tsx      # AnimatePresence wrapper for routes
```

**Implementation:**
- Wrap routes in `AnimatePresence mode="wait"`
- Each page uses shared layout animation with:
  - `initial={{ opacity: 0, y: 8 }}`
  - `animate={{ opacity: 1, y: 0 }}`
  - `exit={{ opacity: 0, y: -8 }}`
- Duration: 300ms with easeInOut

**Integration:**
- Modify `App.tsx` to wrap `<Routes>` with transition provider
- Add `key={pathname}` to route container

---

### System 4: Enhanced Acknowledgment Layer

**Existing:** `useCompanionFeedback` provides toast messages
**Enhancement:** Add inline feedback and button state feedback

**New Components:**

```text
src/components/ui/
├── inline-feedback.tsx      # Small feedback right where action happened
└── responsive-button.tsx    # Button with loading/success states
```

**InlineFeedback**
- Shows beside or below the element that was interacted with
- AnimatePresence with scale + opacity transition
- Auto-dismisses after 1.5s
- Types: success (teal), info (blue), warning (amber)

**ResponsiveButton**
- States: idle → loading → success → idle
- Loading: Spinner + "Working..." text
- Success: Checkmark + "Done!" text (1.5s)
- Prevents double-clicks during loading
- Extends existing Button with same variants

**Integration Points:**
- Quiz answer selection → InlineFeedback appears
- Save actions → ResponsiveButton shows completion
- Form submissions → Button state feedback

---

### System 5: Journey Awareness

**New Store:**

```text
src/stores/
└── journey-store.ts         # Zustand store for session tracking
```

**journeyStore** tracks:
- `pagesViewed: string[]` - Pages visited this session
- `actionsCompleted: string[]` - Key milestones (quiz_started, quiz_completed, trip_created)
- `timeOnSite: number` - Session duration
- `getJourneyStage()` - Returns: new | curious | exploring | in-quiz | post-quiz
- `getSuggestedNextStep()` - Returns contextual CTA based on stage

**JourneyAwareCTA** component:
- Reads from journey store
- Adjusts urgency styling (outline → filled → prominent)
- Changes label based on what user has/hasn't done

**Integration:**
- Track page views in `useEffect` in App.tsx or layout
- Update BrowseNudge to use journey store
- TopNav CTA becomes journey-aware

---

### System 6: Contextual Guidance

**New Components:**

```text
src/components/common/
├── smart-tooltip.tsx        # Tooltips that appear contextually
└── contextual-helper.tsx    # Floating help button + panel
```

**SmartTooltip**
- Props: `showOn: 'hover' | 'first-visit' | 'idle'`
- `first-visit`: Shows once automatically, then never again
- `idle`: Shows after X seconds without interaction
- Uses session storage to track "seen" state

**ContextualHelper**
- Floating help button (bottom-right, above BrowseNudge)
- Opens slide-in panel with page-specific suggestions
- Auto-offers help after 30s on complex pages (quiz, planner)
- Content defined per-page in config object

---

### System 7: Personality & Polish

**Enhancements to existing components:**

**Loading State Personalities**
- Update `PersonalizedLoadingProgress` with visual variants:
  - `travel`: Animated plane following dotted path
  - `pulse`: Breathing icon animation
  - `minimal`: Simple spinner

**Empty State Personalities**
- Create `EmptyState` component with:
  - Floating animated illustration
  - Warm headline + body
  - Companion note (italic, smaller)
  - Optional CTA button

**Error State Personalities**
- Warm error messages from `strangerCopy.micro`
- Retry button with ResponsiveButton behavior

---

## File Structure Summary

```text
New files to create:
├── src/components/ui/
│   ├── magnetic-button.tsx
│   ├── interactive-card.tsx
│   ├── cursor-glow.tsx
│   ├── inline-feedback.tsx
│   └── responsive-button.tsx
├── src/components/common/
│   ├── scroll-reveal.tsx
│   ├── story-progress.tsx
│   ├── parallax-layer.tsx
│   ├── smart-tooltip.tsx
│   ├── contextual-helper.tsx
│   └── empty-state.tsx
├── src/components/layout/
│   └── page-transition.tsx
└── src/stores/
    └── journey-store.ts

Files to modify:
├── src/App.tsx                  # Add page transitions, journey tracking
├── src/components/common/TopNav.tsx  # Journey-aware CTA
├── src/pages/Home.tsx           # Add ScrollReveal, StoryProgress
├── src/pages/Quiz.tsx           # Add InlineFeedback integration
└── src/pages/Start.tsx          # Add ResponsiveButton, SmartTooltip
```

---

## Implementation Priority

| Phase | Components | Impact | Effort |
|-------|-----------|--------|--------|
| 1 | ScrollReveal, InlineFeedback | High - immediate feel | 2 hrs |
| 2 | ResponsiveButton, journey-store | High - action feedback | 2 hrs |
| 3 | MagneticButton, page-transition | Medium - polish | 2 hrs |
| 4 | StoryProgress, SmartTooltip | Medium - guidance | 2 hrs |
| 5 | InteractiveCard, ParallaxLayer | Medium - depth | 2 hrs |
| 6 | ContextualHelper, CursorGlow | Lower - advanced | 2 hrs |
| 7 | EmptyState, error polish | Lower - edge cases | 1 hr |

**Total estimated effort: ~13 hours**

---

## Technical Notes

### Performance Considerations
- CursorGlow only renders on desktop (check `window.matchMedia`)
- ParallaxLayer uses `will-change: transform`
- Page transitions are 300ms max (perceptually instant)
- ScrollReveal uses `once: true` to avoid re-triggering

### Accessibility
- MagneticButton only animates visually, doesn't affect click target
- All animations respect `prefers-reduced-motion`
- Tooltips remain keyboard-accessible
- Focus states preserved on all interactive elements

### Mobile Considerations
- Cursor effects disabled on touch devices
- StoryProgress hidden on mobile
- Page transitions work but are simplified
- Touch feedback via `:active` states preserved

---

## Success Criteria

After implementation, the site should pass these tests:

1. **Click any primary button** → Subtle magnetic pull toward cursor before click
2. **Answer a quiz question** → Inline feedback appears at selection point
3. **Submit a form** → Button shows loading → success state
4. **Scroll homepage** → Content reveals progressively, progress dots update
5. **Navigate between pages** → Smooth fade/slide transitions
6. **Idle for 30s on complex page** → Help panel offers assistance
7. **Hover on key cards** → Additional content reveals with warm animation

The experience should feel like: *"The site is paying attention to me."*

---

## The Before/After

| Before | After |
|--------|-------|
| Pages you read | Conversation you have |
| Forms to fill | Questions to answer |
| Buttons to click | Actions that respond |
| Navigate yourself | Be guided through |
| Generic loading | "Building your trip..." |
| Static illustrations | Living, breathing elements |
| Hard page cuts | Flowing transitions |
| Silent errors | "Let's try that again." |

