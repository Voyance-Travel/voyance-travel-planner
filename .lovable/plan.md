

# Add Screen Recordings to CustomizationShowcase Section

## Overview

Update the "Full Control. Your Way." section to display real screen recordings (GIFs or MP4 videos) of Voyance features in action. The component is already structured with placeholders, so we'll enhance it to display your recordings once uploaded.

---

## What You Need to Record

Create 4 screen recordings demonstrating these features:

| Feature | Filename | What to Record |
|---------|----------|----------------|
| **Find Alternatives** | `swap-activity-demo.gif` | Show the swap modal opening, filtering options, selecting a new activity, and the itinerary updating |
| **Budget Updates** | `budget-update-demo.gif` | Swap an activity and show the budget bar recalculating in real-time |
| **AI Chat** | `ai-chat-demo.gif` | Type a request to the Trip Assistant and show it modifying the itinerary |
| **Reserve & Book** | `booking-links-demo.gif` | Click on booking links showing Viator, Google Maps, reservation options |

### Recording Recommendations
- **Format**: GIF (for auto-loop) or MP4/WebM (for smaller file size with controls)
- **Aspect ratio**: 4:3 (matches card layout)
- **Duration**: 5-10 seconds each, looping
- **Resolution**: 800x600px or similar
- **Tools**: Loom, QuickTime, Kap (Mac), ScreenToGif (Windows)

---

## Implementation Steps

### 1. Upload Your Recordings
Once you have the files ready, upload them through the chat and I'll copy them to `public/demos/`

### 2. Update CustomizationShowcase Component
Modify the component to display actual video/GIF content:

- Replace placeholder divs with `<video>` elements for MP4/WebM (auto-play, loop, muted)
- Or use `<img>` elements for GIF files
- Add loading states and fallback UI
- Ensure responsive sizing

### 3. Add Fallback Behavior
Keep the current placeholder UI as a fallback if videos fail to load

---

## File Changes

| File | Change |
|------|--------|
| `public/demos/` | New directory for demo recordings |
| `src/components/home/CustomizationShowcase.tsx` | Update to display real recordings |

---

## Next Steps

1. Create your 4 screen recordings following the specs above
2. Upload them to the chat (GIF, MP4, or WebM format)
3. I'll implement the component changes and copy files to the project

