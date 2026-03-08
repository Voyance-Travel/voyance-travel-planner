/**
 * Centralized error message map for user-facing error copy.
 * 
 * Rules:
 * - Never use "failed", "error", "broken", "crash", or "fault" in user-facing copy
 * - Keep messages short (under 15 words)
 * - Always suggest a next action ("try again", "check back", "adjust your search")
 * - Use toast() (neutral) not toast.error() (red) — reserve toast.error() only for truly destructive actions
 */

export type ErrorContext = 
  | 'generation' 
  | 'smartFinish' 
  | 'chat' 
  | 'hotel' 
  | 'auth' 
  | 'purchase' 
  | 'general'
  | 'activity'
  | 'regenerate'
  | 'swap'
  | 'restaurant';

const ERROR_MESSAGES: Record<ErrorContext, Record<string, string>> = {
  generation: {
    ai_unavailable: "We're having trouble building your itinerary right now. Give it another shot.",
    invalid_input: "We need a bit more detail about your trip. Try adjusting your dates or destination.",
    timeout: "Your itinerary is taking longer than expected. We'll keep working on it.",
    internal_error: "Something hiccuped on our end. Let's try that again.",
    not_found: "We can't find that trip. It may have been removed.",
    still_processing: "We're still working on your itinerary. Check back in a moment.",
    default: "We ran into a snag. Let's try again.",
  },
  smartFinish: {
    ai_unavailable: "The finishing touches are taking a moment. Check back shortly.",
    timeout: "Still polishing your itinerary. Check back in a minute.",
    still_processing: "We're still working on the finishing touches. Check back in a moment.",
    default: "We're still working on this. Your credits are safe.",
  },
  chat: {
    ai_unavailable: "Our travel assistant is taking a quick break. Try sending your message again.",
    internal_error: "Didn't catch that. Could you try again?",
    default: "Let's try that again.",
  },
  hotel: {
    search_unavailable: "Hotel search is temporarily unavailable. Try again in a moment.",
    not_found: "We couldn't find hotels matching your criteria. Try adjusting your search.",
    default: "Hotel search hit a bump. Give it another try.",
  },
  auth: {
    unauthorized: "Please sign in to continue.",
    invalid_credentials: "Sign-in didn't work. Please check your email and password.",
    default: "Sign-in didn't work. Please try again.",
  },
  purchase: {
    insufficient_credits: "Not enough credits for this action.",
    payment_failed: "The purchase didn't go through. No charges were made.",
    default: "The purchase didn't go through. No charges were made.",
  },
  activity: {
    not_found: "We can't find that activity. It may have been removed.",
    default: "We ran into a snag updating the activity. Try again.",
  },
  regenerate: {
    ai_unavailable: "We're having trouble regenerating right now. Give it another shot.",
    timeout: "This is taking longer than expected. Check back shortly.",
    default: "Let's try regenerating again.",
  },
  swap: {
    ai_unavailable: "Activity swap is temporarily unavailable. Try again in a moment.",
    not_found: "We couldn't find a good alternative. Try adjusting your preferences.",
    default: "Swap didn't work. Give it another try.",
  },
  restaurant: {
    not_found: "We couldn't find restaurants matching your criteria. Try adjusting your search.",
    default: "Restaurant search hit a bump. Try again.",
  },
  general: {
    network_error: "Check your connection and try again.",
    default: "Something didn't work as expected. Let's try again.",
  },
};

/**
 * Get a user-friendly error message based on context and error code.
 * Always returns a friendly, actionable message (never throws).
 */
export const getErrorMessage = (context: ErrorContext, errorCode?: string): string => {
  const contextMessages = ERROR_MESSAGES[context] || ERROR_MESSAGES.general;
  
  if (errorCode && contextMessages[errorCode]) {
    return contextMessages[errorCode];
  }
  
  return contextMessages.default || ERROR_MESSAGES.general.default;
};

/**
 * Helper to extract error code from various error response formats
 */
export const extractErrorCode = (error: unknown): string | undefined => {
  if (typeof error === 'string') return error;
  
  if (error && typeof error === 'object') {
    const err = error as any;
    
    // Check common error response formats
    if (err.code) return err.code;
    if (err.error) return typeof err.error === 'string' ? err.error : err.error?.code;
    if (err.message) return err.message;
    if (err.data?.error) return err.data.error;
  }
  
  return undefined;
};
