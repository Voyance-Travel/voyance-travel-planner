/**
 * Micro-Feedback Library
 * 
 * Short, warm acknowledgments for every micro-interaction.
 * These accumulate to create the "gets me" feeling.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BASIC ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const microFeedback = {
  // Positive actions
  saved: "Saved.",
  favorited: "Good eye.",
  added: "Added.",
  removed: "Gone.",
  updated: "Updated.",
  copied: "Copied.",
  shared: "Shared.",
  done: "Done.",
  
  // Confirmations
  gotIt: "Got it.",
  noted: "Noted.",
  understood: "Understood.",
  
  // Trip actions
  tripCreated: "Your trip is ready.",
  tripDeleted: "Trip removed.",
  tripDuplicated: "Duplicated. Make it yours.",
  tripSaved: "Trip saved.",
  
  // Reservation actions
  reservationMarked: "We'll remind you to book this.",
  reservationBooked: "Booked. One less thing to worry about.",
  reservationCanceled: "Canceled.",
  
  // Itinerary actions
  itineraryModified: "Changes saved.",
  activityMoved: "Moved.",
  activitySwapped: "Swapped.",
  activityRemoved: "Removed. Your trip, your rules.",
  activityAdded: "Added.",
  
  // Free time / spacing
  freeTimeAdded: "Breathing room. Smart.",
  bufferAdded: "Space. Good.",
  
  // Navigation (silent)
  scrolledToSection: null,
  openedDetails: null,
  collapsedDetails: null,
  
  // Loading confirmations
  loading: "Working on it...",
  loadingComplete: "Done.",
  
  // Settings
  settingsSaved: "Preferences saved.",
  preferencesUpdated: "Updated. We'll remember that.",
};

// ═══════════════════════════════════════════════════════════════════════════════
// ARCHETYPE-AWARE FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════════

const archetypeOverrides: Record<string, Record<string, string>> = {
  freeTimeAdded: {
    slow_traveler: "The best part of any day. Protected.",
    adrenaline_architect: "Even you need to breathe sometimes.",
    flexible_wanderer: "Room to discover something unexpected.",
    zen_seeker: "Space is sacred. Good.",
    beach_therapist: "Nothing time. Perfect.",
    default: "Breathing room. Smart.",
  },
  
  activityRemoved: {
    slow_traveler: "Less is more.",
    bucket_list_conqueror: "Making room for what matters more?",
    adrenaline_architect: "On to the next one.",
    flexible_wanderer: "Your call.",
    default: "Gone.",
  },
  
  activityAdded: {
    slow_traveler: "If you have time.",
    adrenaline_architect: "Let's go.",
    culinary_cartographer: "Good choice.",
    bucket_list_conqueror: "On the list.",
    default: "Added.",
  },
  
  itineraryModified: {
    flexible_wanderer: "Plans updated. Or not. Your call.",
    slow_traveler: "Changed saved. Take your time.",
    adrenaline_architect: "Optimized.",
    default: "Changes saved.",
  },
};

/**
 * Get feedback message, optionally personalized by archetype
 */
export function getMicroFeedback(action: keyof typeof microFeedback, archetype?: string): string | null {
  // Check for archetype-specific override
  if (archetype && archetypeOverrides[action]) {
    const overrides = archetypeOverrides[action];
    return overrides[archetype] || overrides.default || microFeedback[action];
  }
  
  return microFeedback[action];
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE REPLACEMENTS (generic -> warm)
// ═══════════════════════════════════════════════════════════════════════════════

export const voiceReplacements: Record<string, string> = {
  // Button labels
  "Submit": "Let's do this",
  "Continue": "Next",
  "Cancel": "Never mind",
  "Delete": "Remove",
  "Save": "Save",
  "Close": "Done",
  
  // Form labels
  "Select your budget": "How do you like to spend?",
  "Add travelers": "Who's coming with you?",
  "Enter destination": "Where to?",
  "Select dates": "When?",
  "Choose trip type": "What's the occasion?",
  
  // Loading states
  "Loading...": "One moment...",
  "Generating itinerary...": "Building your trip...",
  "Processing...": "Working on it...",
  "Please wait...": "Almost ready...",
  
  // Success states
  "Successfully saved": "Saved.",
  "Successfully deleted": "Removed.",
  "Operation complete": "Done.",
  "Itinerary generated": "Your trip is ready.",
  
  // Error states
  "An error occurred": "Something went wrong.",
  "Invalid input": "That doesn't look right.",
  "Required field": "We need this one.",
  "Network error": "Connection trouble.",
  
  // Empty states
  "No results found": "Nothing here yet.",
  "No items": "Empty for now.",
  "No data available": "Nothing to show.",
};

/**
 * Replace generic text with warm alternatives
 */
export function warmify(text: string): string {
  return voiceReplacements[text] || text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMATION DIALOGS
// ═══════════════════════════════════════════════════════════════════════════════

export const confirmationDialogs = {
  deleteTrip: {
    title: "Delete this trip?",
    description: "This can't be undone. All your planning goes away.",
    confirm: "Delete it",
    cancel: "Keep it",
  },
  
  removeActivity: {
    title: "Remove this activity?",
    description: "It'll be gone from your itinerary.",
    confirm: "Remove",
    cancel: "Keep it",
  },
  
  discardChanges: {
    title: "Discard changes?",
    description: "You've made changes that haven't been saved.",
    confirm: "Discard",
    cancel: "Keep editing",
  },
  
  logout: {
    title: "Log out?",
    description: "You can always log back in.",
    confirm: "Log out",
    cancel: "Stay",
  },
  
  cancelReservation: {
    title: "Cancel this reservation?",
    description: "You may need to rebook.",
    confirm: "Cancel it",
    cancel: "Keep it",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLTIP TEXT
// ═══════════════════════════════════════════════════════════════════════════════

export const tooltips = {
  // Itinerary actions
  moveActivity: "Drag to move",
  removeActivity: "Remove from itinerary",
  editActivity: "Edit details",
  favoriteActivity: "Save to favorites",
  
  // Trip actions
  shareTrip: "Share this trip",
  duplicateTrip: "Make a copy",
  printTrip: "Print itinerary",
  downloadTrip: "Download PDF",
  
  // Settings
  darkMode: "Toggle dark mode",
  notifications: "Notification preferences",
  
  // Navigation
  backToTrips: "Back to your trips",
  viewProfile: "Your travel DNA",
  help: "Need help?",
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLACEHOLDER TEXT
// ═══════════════════════════════════════════════════════════════════════════════

export const placeholders = {
  destination: "Where do you want to go?",
  originCity: "Flying from...",
  hotelName: "Hotel name",
  notes: "Add a note...",
  searchActivities: "Search activities...",
  feedback: "Tell us what you think...",
  tripName: "Name this trip...",
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a random item from an array of messages
 */
export function randomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Format a count with appropriate text
 */
export function formatCount(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

/**
 * Get time-of-day greeting
 */
export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

/**
 * Get contextual greeting with name
 */
export function getGreeting(name?: string): string {
  const timeGreeting = getTimeGreeting();
  return name ? `${timeGreeting}, ${name}.` : `${timeGreeting}.`;
}
