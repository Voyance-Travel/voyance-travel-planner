/**
 * Centralized Warm Micro-Copy
 * Human-centric language that makes the app feel like a knowledgeable friend
 */

export const copy = {
  // Call-to-action buttons
  cta: {
    continue: "Let's do this",
    skip: "I'll add this later",
    generate: "Build my trip",
    view: "Show me",
    save: "Save",
    cancel: "Never mind",
    done: "Done",
    next: "Next",
    back: "Go back",
    edit: "Make changes",
    delete: "Remove",
    share: "Send this to your travel crew",
    retake: "Retake Quiz",
    planTrip: "Plan a trip like this",
    explore: "Start exploring",
    viewDNA: "View My Travel DNA",
    buildItinerary: "Build My Itinerary",
    findHotels: "Find Hotels",
  },

  // Loading states
  loading: {
    itinerary: "Building your perfect trip...",
    hotels: "Finding places you'll actually like...",
    activities: "Curating your days...",
    flights: "Searching the skies...",
    dna: "Reading your travel personality...",
    saving: "Saving your changes...",
    generating: "This is going to be good...",
    searching: "Looking for the perfect match...",
  },

  // Success messages
  success: {
    tripReady: (destination: string) => `Your ${destination} trip is ready. This is going to be good.`,
    saved: "Saved. We'll remember that.",
    updated: "Updated. Your trip just got better.",
    added: "Added to your trip.",
    removed: "Removed.",
    copied: "Copied to clipboard.",
    shared: "Shared successfully.",
    feedback: "Thanks for the feedback. It helps.",
  },

  // Validation messages (friendly, not scary)
  validation: {
    dateConflict: "Those dates don't quite work. Want to adjust?",
    missingDestination: "Where are we going?",
    missingDates: "When's this happening?",
    invalidEmail: "That email doesn't look quite right.",
    required: "We need this one.",
    tooShort: "A bit more detail would help.",
    tooLong: "That's a lot—can you trim it down?",
    invalidFormat: "That doesn't look quite right.",
  },

  // Empty states
  empty: {
    noResults: "Nothing here yet. Let's change that.",
    noTrips: "No trips planned yet. Where should we go?",
    noActivities: "This day is wide open.",
    noHotels: "Still looking for the perfect place to stay.",
    noFlights: "No flights added yet.",
  },

  // Error states (calm, not alarming)
  error: {
    generic: "Something went wrong. Let's try that again.",
    network: "Having trouble connecting. Check your internet?",
    notFound: "Couldn't find that. It might have moved.",
    unauthorized: "You'll need to sign in for this.",
    rateLimit: "Slow down! Give us a second.",
    timeout: "That took too long. Want to try again?",
  },

  // Form labels (conversational)
  labels: {
    destination: "Where to?",
    departureCity: "Flying from",
    dates: "When",
    startDate: "Leaving",
    endDate: "Coming back",
    travelers: "Who's coming?",
    budget: "How do you like to spend?",
    tripType: "What's the occasion?",
    accommodation: "Where do you want to stay?",
    pace: "What's your vibe?",
    interests: "What are you into?",
    name: "Give this trip a name",
    email: "Your email",
    password: "Your password",
  },

  // Placeholders
  placeholders: {
    destination: "Paris, Tokyo, Bali...",
    departureCity: "New York, London...",
    tripName: "Summer Adventure 2024",
    hotel: "Where are you staying?",
    activity: "What do you want to do?",
    search: "Search...",
    notes: "Any notes for this?",
  },

  // Quiz and DNA
  quiz: {
    progress: (current: number, total: number) => `${current} of ${total}`,
    complete: "You're all set!",
    dnaCreated: "We've created your Travel DNA profile.",
    dnaDescription: "View your unique travel personality and start planning your perfect trip.",
  },

  // Trip planning
  planning: {
    addGuests: "Add your travel crew",
    guestsAdded: (count: number) => `${count} ${count === 1 ? 'traveler' : 'travelers'} ready to go`,
    dayOf: (dayNum: number) => `Day ${dayNum}`,
    firstTime: "First time here?",
    returning: "Been here before?",
  },

  // Tooltips and help text
  help: {
    budget: "This helps us find options that match your style.",
    dates: "Flexible? We can work with rough dates.",
    travelers: "Include yourself in the count.",
    tripType: "Different occasions call for different vibes.",
  },
};

/**
 * Get a random variant of loading text for variety
 */
export function getLoadingText(): string {
  const variants = [
    "Building your perfect trip...",
    "This is going to be good...",
    "Almost there...",
    "Putting the finishing touches...",
    "Making it just right...",
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}
