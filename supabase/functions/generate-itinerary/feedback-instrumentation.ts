/**
 * FEEDBACK LOOP INSTRUMENTATION
 * 
 * Track user interactions to improve personalization:
 * - What users replace (and with what)
 * - What they save
 * - What they mark "not me"
 * - Time spent editing each day
 * 
 * This data feeds back into weighting and candidate ranking.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FeedbackEvent {
  eventType: FeedbackEventType;
  timestamp: string;
  tripId: string;
  userId: string;
  dayNumber?: number;
  activityId?: string;
  activityTitle?: string;
  activityCategory?: string;
  personalizationTags?: string[];
  metadata: Record<string, unknown>;
}

export type FeedbackEventType = 
  | 'activity_replaced'     // User swapped an activity for another
  | 'activity_saved'        // User locked/saved an activity
  | 'activity_removed'      // User removed an activity
  | 'activity_not_me'       // User marked "not for me"
  | 'day_regenerated'       // User regenerated entire day
  | 'day_edited_time'       // Time spent editing a day
  | 'alternative_searched'  // User searched for alternatives
  | 'alternative_selected'  // User selected from alternatives
  | 'itinerary_completed'   // User marked trip as done
  | 'rating_submitted';     // User rated an activity post-trip

export interface ReplacementSignal {
  originalActivity: {
    id: string;
    title: string;
    category: string;
    tags: string[];
    matchedInputs: string[];
  };
  newActivity: {
    id: string;
    title: string;
    category: string;
    tags: string[];
    searchQuery?: string; // What the user searched for
  };
  inferencedPreference: string; // What we learn from this replacement
}

export interface EditingMetrics {
  tripId: string;
  userId: string;
  dayNumber: number;
  timeSpentSeconds: number;
  actionsCount: {
    swaps: number;
    saves: number;
    removes: number;
    searches: number;
  };
  satisfactionIndicator: 'high' | 'medium' | 'low'; // Inferred from actions
}

export interface AggregatedLearning {
  userId: string;
  learnedPreferences: {
    strongPositive: string[];  // Tags that appear on saved activities
    strongNegative: string[];  // Tags that appear on replaced/removed activities
    weakPositive: string[];    // Tags that appear but with mixed signals
    weakNegative: string[];    // Tags that sometimes get replaced
  };
  categoryPreferences: Record<string, number>; // category -> preference score
  paceIndicator: 'wants_more' | 'satisfied' | 'wants_less';
  lastUpdated: string;
}

// =============================================================================
// SIGNAL EXTRACTION
// =============================================================================

/**
 * Extract learning signal from a replacement event
 */
export function extractReplacementSignal(
  original: {
    id: string;
    title: string;
    category: string;
    tags?: string[];
    personalization?: { matchedInputs?: string[] };
  },
  replacement: {
    id: string;
    title: string;
    category: string;
    tags?: string[];
    searchQuery?: string;
  }
): ReplacementSignal {
  const originalTags = original.tags || [];
  const newTags = replacement.tags || [];
  
  // Tags that were on original but NOT on replacement = negative signal
  const rejectedTags = originalTags.filter(t => !newTags.includes(t));
  
  // Tags that are on replacement but NOT on original = positive signal
  const preferredTags = newTags.filter(t => !originalTags.includes(t));
  
  // Category change signal
  const categoryChange = original.category !== replacement.category 
    ? `Prefers ${replacement.category} over ${original.category}` 
    : '';
  
  // Search query signal (if user searched)
  const searchSignal = replacement.searchQuery 
    ? `Searched for: ${replacement.searchQuery}` 
    : '';
  
  // Build inference
  const inferenceParts: string[] = [];
  
  if (rejectedTags.length > 0) {
    inferenceParts.push(`Rejected: ${rejectedTags.slice(0, 3).join(', ')}`);
  }
  if (preferredTags.length > 0) {
    inferenceParts.push(`Preferred: ${preferredTags.slice(0, 3).join(', ')}`);
  }
  if (categoryChange) {
    inferenceParts.push(categoryChange);
  }
  if (searchSignal) {
    inferenceParts.push(searchSignal);
  }
  
  return {
    originalActivity: {
      id: original.id,
      title: original.title,
      category: original.category,
      tags: originalTags,
      matchedInputs: original.personalization?.matchedInputs || []
    },
    newActivity: {
      id: replacement.id,
      title: replacement.title,
      category: replacement.category,
      tags: newTags,
      searchQuery: replacement.searchQuery
    },
    inferencedPreference: inferenceParts.join(' | ') || 'General preference shift'
  };
}

/**
 * Calculate editing metrics for a day
 */
export function calculateEditingMetrics(
  events: FeedbackEvent[],
  tripId: string,
  userId: string,
  dayNumber: number
): EditingMetrics {
  const dayEvents = events.filter(e => 
    e.tripId === tripId && 
    e.userId === userId && 
    e.dayNumber === dayNumber
  );
  
  const swaps = dayEvents.filter(e => 
    e.eventType === 'activity_replaced' || e.eventType === 'alternative_selected'
  ).length;
  
  const saves = dayEvents.filter(e => e.eventType === 'activity_saved').length;
  const removes = dayEvents.filter(e => 
    e.eventType === 'activity_removed' || e.eventType === 'activity_not_me'
  ).length;
  const searches = dayEvents.filter(e => e.eventType === 'alternative_searched').length;
  
  // Time spent (sum of day_edited_time events)
  const timeEvents = dayEvents.filter(e => e.eventType === 'day_edited_time');
  const timeSpent = timeEvents.reduce((sum, e) => 
    sum + (typeof e.metadata.seconds === 'number' ? e.metadata.seconds : 0), 0
  );
  
  // Infer satisfaction
  // High: mostly saves, few changes
  // Medium: some changes, some saves
  // Low: many changes, few saves, high time spent
  let satisfactionIndicator: 'high' | 'medium' | 'low' = 'medium';
  
  const totalActions = swaps + saves + removes;
  if (totalActions === 0) {
    satisfactionIndicator = saves > 0 ? 'high' : 'medium';
  } else {
    const saveRatio = saves / totalActions;
    const changeRatio = (swaps + removes) / totalActions;
    
    if (saveRatio >= 0.6) satisfactionIndicator = 'high';
    else if (changeRatio >= 0.6) satisfactionIndicator = 'low';
  }
  
  return {
    tripId,
    userId,
    dayNumber,
    timeSpentSeconds: timeSpent,
    actionsCount: { swaps, saves, removes, searches },
    satisfactionIndicator
  };
}

// =============================================================================
// AGGREGATED LEARNING
// =============================================================================

/**
 * Aggregate learning from multiple feedback events
 */
export function aggregateLearnings(
  events: FeedbackEvent[],
  userId: string
): AggregatedLearning {
  const tagScores = new Map<string, number>();
  const categoryScores = new Map<string, number>();
  let paceSwapsTowardsFewer = 0;
  let paceSwapsTowardsMore = 0;
  
  for (const event of events) {
    if (event.userId !== userId) continue;
    
    const tags = event.personalizationTags || [];
    
    switch (event.eventType) {
      case 'activity_saved':
        // Positive signal for all tags
        for (const tag of tags) {
          tagScores.set(tag, (tagScores.get(tag) || 0) + 2);
        }
        if (event.activityCategory) {
          categoryScores.set(event.activityCategory, (categoryScores.get(event.activityCategory) || 0) + 2);
        }
        break;
        
      case 'activity_replaced':
      case 'activity_not_me':
        // Negative signal for original tags
        for (const tag of tags) {
          tagScores.set(tag, (tagScores.get(tag) || 0) - 1);
        }
        if (event.activityCategory) {
          categoryScores.set(event.activityCategory, (categoryScores.get(event.activityCategory) || 0) - 1);
        }
        break;
        
      case 'activity_removed':
        // Might indicate wanting fewer activities (pace signal)
        paceSwapsTowardsFewer++;
        for (const tag of tags) {
          tagScores.set(tag, (tagScores.get(tag) || 0) - 0.5);
        }
        break;
        
      case 'alternative_searched':
        // User actively seeking something different
        for (const tag of tags) {
          tagScores.set(tag, (tagScores.get(tag) || 0) - 0.5);
        }
        break;
        
      case 'day_regenerated':
        // Strong signal that day didn't match
        // Could indicate many things - note for analysis
        break;
    }
  }
  
  // Categorize tags by score
  const strongPositive: string[] = [];
  const strongNegative: string[] = [];
  const weakPositive: string[] = [];
  const weakNegative: string[] = [];
  
  for (const [tag, score] of tagScores) {
    if (score >= 3) strongPositive.push(tag);
    else if (score >= 1) weakPositive.push(tag);
    else if (score <= -2) strongNegative.push(tag);
    else if (score < 0) weakNegative.push(tag);
  }
  
  // Determine pace indicator
  let paceIndicator: 'wants_more' | 'satisfied' | 'wants_less' = 'satisfied';
  const paceNetSignal = paceSwapsTowardsMore - paceSwapsTowardsFewer;
  if (paceNetSignal >= 2) paceIndicator = 'wants_more';
  else if (paceNetSignal <= -2) paceIndicator = 'wants_less';
  
  return {
    userId,
    learnedPreferences: {
      strongPositive,
      strongNegative,
      weakPositive,
      weakNegative
    },
    categoryPreferences: Object.fromEntries(categoryScores),
    paceIndicator,
    lastUpdated: new Date().toISOString()
  };
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Build SQL upsert for user_enrichment table
 */
export function buildEnrichmentUpsert(event: FeedbackEvent): {
  table: 'user_enrichment';
  data: Record<string, unknown>;
} {
  return {
    table: 'user_enrichment',
    data: {
      user_id: event.userId,
      enrichment_type: mapEventTypeToEnrichmentType(event.eventType),
      action_type: event.eventType,
      feedback_tags: event.personalizationTags || [],
      metadata: {
        trip_id: event.tripId,
        day_number: event.dayNumber,
        activity_id: event.activityId,
        activity_title: event.activityTitle,
        activity_category: event.activityCategory,
        ...event.metadata
      },
      created_at: event.timestamp
    }
  };
}

function mapEventTypeToEnrichmentType(eventType: FeedbackEventType): string {
  const mapping: Record<FeedbackEventType, string> = {
    'activity_replaced': 'activity_swap',
    'activity_saved': 'activity_save',
    'activity_removed': 'activity_remove',
    'activity_not_me': 'activity_reject',
    'day_regenerated': 'day_refresh',
    'day_edited_time': 'editing_session',
    'alternative_searched': 'search_query',
    'alternative_selected': 'alternative_select',
    'itinerary_completed': 'trip_complete',
    'rating_submitted': 'activity_rating'
  };
  return mapping[eventType] || 'unknown';
}

// =============================================================================
// PROMPT GENERATION FOR PERSONALIZATION WEIGHT ADJUSTMENT
// =============================================================================

/**
 * Generate prompt section with learned preferences
 */
export function buildLearnedPreferencesPrompt(learning: AggregatedLearning): string {
  if (!learning.learnedPreferences.strongPositive.length && 
      !learning.learnedPreferences.strongNegative.length) {
    return '';
  }
  
  const parts: string[] = [];
  
  if (learning.learnedPreferences.strongPositive.length > 0) {
    parts.push(`STRONGLY PREFER (from past behavior): ${learning.learnedPreferences.strongPositive.slice(0, 5).join(', ')}`);
  }
  
  if (learning.learnedPreferences.strongNegative.length > 0) {
    parts.push(`STRONGLY AVOID (from past rejections): ${learning.learnedPreferences.strongNegative.slice(0, 5).join(', ')}`);
  }
  
  if (learning.paceIndicator !== 'satisfied') {
    const paceNote = learning.paceIndicator === 'wants_more' 
      ? 'User tends to add activities - can pack days more'
      : 'User tends to remove activities - keep days lighter';
    parts.push(`PACE ADJUSTMENT: ${paceNote}`);
  }
  
  // Category preferences
  const topCategories = Object.entries(learning.categoryPreferences)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .filter(([, score]) => score > 0);
  
  if (topCategories.length > 0) {
    parts.push(`FAVORITE CATEGORIES: ${topCategories.map(([cat]) => cat).join(', ')}`);
  }
  
  return parts.length > 0 
    ? `\n## 📊 LEARNED FROM PAST BEHAVIOR\n${parts.join('\n')}` 
    : '';
}

// =============================================================================
// INSTRUMENTATION HELPERS
// =============================================================================

/**
 * Create a feedback event for activity replacement
 */
export function createReplacementEvent(
  tripId: string,
  userId: string,
  dayNumber: number,
  original: { id: string; title: string; category: string; tags?: string[] },
  replacement: { id: string; title: string; category: string; tags?: string[]; searchQuery?: string }
): FeedbackEvent {
  const signal = extractReplacementSignal(original, replacement);
  
  return {
    eventType: 'activity_replaced',
    timestamp: new Date().toISOString(),
    tripId,
    userId,
    dayNumber,
    activityId: original.id,
    activityTitle: original.title,
    activityCategory: original.category,
    personalizationTags: original.tags,
    metadata: {
      original_activity: signal.originalActivity,
      new_activity: signal.newActivity,
      inferred_preference: signal.inferencedPreference
    }
  };
}

/**
 * Create a feedback event for activity save
 */
export function createSaveEvent(
  tripId: string,
  userId: string,
  dayNumber: number,
  activity: { id: string; title: string; category: string; tags?: string[] }
): FeedbackEvent {
  return {
    eventType: 'activity_saved',
    timestamp: new Date().toISOString(),
    tripId,
    userId,
    dayNumber,
    activityId: activity.id,
    activityTitle: activity.title,
    activityCategory: activity.category,
    personalizationTags: activity.tags,
    metadata: {}
  };
}

/**
 * Create a feedback event for "not me" marking
 */
export function createNotMeEvent(
  tripId: string,
  userId: string,
  dayNumber: number,
  activity: { id: string; title: string; category: string; tags?: string[] },
  reason?: string
): FeedbackEvent {
  return {
    eventType: 'activity_not_me',
    timestamp: new Date().toISOString(),
    tripId,
    userId,
    dayNumber,
    activityId: activity.id,
    activityTitle: activity.title,
    activityCategory: activity.category,
    personalizationTags: activity.tags,
    metadata: { reason }
  };
}
