// =============================================================================
// PACKING SUGGESTIONS - Activity-Driven Gear Recommendations
// =============================================================================
// Analyzes the generated itinerary to suggest packing items based on:
// - Activity types (hiking = hiking shoes, beach = swimsuit)
// - Weather conditions
// - Cultural requirements (temples = modest clothing)
// - Duration and logistics
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

export interface PackingItem {
  item: string;
  category: 'clothing' | 'footwear' | 'accessories' | 'electronics' | 'toiletries' | 'documents' | 'misc';
  priority: 'essential' | 'recommended' | 'optional';
  reason: string;
  forDays?: number[]; // Which days specifically need this
  forActivities?: string[]; // Which activities need this
}

export interface PackingList {
  items: PackingItem[];
  byCategory: Map<string, PackingItem[]>;
  byDay: Map<number, PackingItem[]>;
  specialNotes: string[];
  promptSection: string;
}

// =============================================================================
// ACTIVITY → PACKING MAPPINGS
// =============================================================================

const ACTIVITY_PACKING_RULES: Record<string, PackingItem[]> = {
  // Outdoor/Adventure
  'hiking': [
    { item: 'Hiking boots/sturdy shoes', category: 'footwear', priority: 'essential', reason: 'Hiking activity requires proper footwear' },
    { item: 'Daypack/backpack', category: 'accessories', priority: 'essential', reason: 'To carry water and snacks on hikes' },
    { item: 'Water bottle', category: 'accessories', priority: 'essential', reason: 'Stay hydrated during outdoor activities' },
    { item: 'Sunscreen SPF 30+', category: 'toiletries', priority: 'essential', reason: 'Sun protection for outdoor activities' },
    { item: 'Hat/cap', category: 'accessories', priority: 'recommended', reason: 'Sun protection' },
  ],
  'beach': [
    { item: 'Swimsuit(s)', category: 'clothing', priority: 'essential', reason: 'Beach activities' },
    { item: 'Beach towel', category: 'accessories', priority: 'recommended', reason: 'Many hotels provide, but good to have your own' },
    { item: 'Flip flops/sandals', category: 'footwear', priority: 'essential', reason: 'Beach footwear' },
    { item: 'Sunscreen SPF 30+', category: 'toiletries', priority: 'essential', reason: 'Sun protection at the beach' },
    { item: 'Sunglasses', category: 'accessories', priority: 'essential', reason: 'Eye protection' },
    { item: 'Beach cover-up', category: 'clothing', priority: 'recommended', reason: 'For walking to/from beach' },
  ],
  'snorkeling': [
    { item: 'Rash guard/swim shirt', category: 'clothing', priority: 'recommended', reason: 'Sun protection while snorkeling' },
    { item: 'Waterproof phone pouch', category: 'accessories', priority: 'optional', reason: 'Protect electronics near water' },
    { item: 'Reef-safe sunscreen', category: 'toiletries', priority: 'essential', reason: 'Protect coral reefs' },
  ],
  'cycling': [
    { item: 'Comfortable athletic wear', category: 'clothing', priority: 'recommended', reason: 'Cycling activity' },
    { item: 'Sneakers/cycling shoes', category: 'footwear', priority: 'essential', reason: 'Proper footwear for cycling' },
  ],
  'spa': [
    { item: 'Comfortable loungewear', category: 'clothing', priority: 'optional', reason: 'For spa relaxation' },
  ],
  
  // Cultural/Religious
  'temple': [
    { item: 'Modest clothing (covers shoulders & knees)', category: 'clothing', priority: 'essential', reason: 'Required for temple visits' },
    { item: 'Scarf/shawl', category: 'accessories', priority: 'recommended', reason: 'Can cover shoulders if needed' },
    { item: 'Socks', category: 'clothing', priority: 'essential', reason: 'Shoes must be removed at many temples' },
  ],
  'mosque': [
    { item: 'Long pants/skirt', category: 'clothing', priority: 'essential', reason: 'Required for mosque visits' },
    { item: 'Long-sleeve top', category: 'clothing', priority: 'essential', reason: 'Required for mosque visits' },
    { item: 'Headscarf (women)', category: 'accessories', priority: 'essential', reason: 'Required at most mosques' },
  ],
  'church': [
    { item: 'Modest clothing', category: 'clothing', priority: 'recommended', reason: 'Respectful attire for church visits' },
  ],
  
  // Dining/Nightlife
  'fine_dining': [
    { item: 'Smart casual outfit', category: 'clothing', priority: 'essential', reason: 'Dress code at fine dining restaurants' },
    { item: 'Dress shoes', category: 'footwear', priority: 'recommended', reason: 'Some restaurants have dress codes' },
  ],
  'club': [
    { item: 'Going-out outfit', category: 'clothing', priority: 'recommended', reason: 'Nightclub dress code' },
    { item: 'Closed-toe shoes', category: 'footwear', priority: 'recommended', reason: 'Many clubs require closed-toe shoes' },
  ],
  
  // Weather-specific
  'rain': [
    { item: 'Rain jacket/umbrella', category: 'accessories', priority: 'essential', reason: 'Expected rain during your trip' },
    { item: 'Waterproof shoes/boots', category: 'footwear', priority: 'recommended', reason: 'Keep feet dry in rain' },
  ],
  'cold': [
    { item: 'Warm jacket/coat', category: 'clothing', priority: 'essential', reason: 'Cold weather expected' },
    { item: 'Layers (sweaters, thermals)', category: 'clothing', priority: 'essential', reason: 'Layering for cold weather' },
    { item: 'Warm hat/gloves', category: 'accessories', priority: 'recommended', reason: 'Cold weather accessories' },
  ],
  'hot': [
    { item: 'Lightweight, breathable clothing', category: 'clothing', priority: 'essential', reason: 'Hot weather expected' },
    { item: 'Wide-brimmed hat', category: 'accessories', priority: 'recommended', reason: 'Sun protection in hot weather' },
  ],
  
  // Photography
  'photography': [
    { item: 'Camera/phone with good camera', category: 'electronics', priority: 'recommended', reason: 'Scenic locations on itinerary' },
    { item: 'Extra batteries/power bank', category: 'electronics', priority: 'recommended', reason: 'Keep devices charged' },
    { item: 'Camera bag', category: 'accessories', priority: 'optional', reason: 'Protect camera equipment' },
  ],
};

// =============================================================================
// UNIVERSAL ITEMS (Always recommend)
// =============================================================================

const UNIVERSAL_ITEMS: PackingItem[] = [
  { item: 'Passport', category: 'documents', priority: 'essential', reason: 'International travel' },
  { item: 'Travel insurance documents', category: 'documents', priority: 'essential', reason: 'Emergency preparedness' },
  { item: 'Phone charger', category: 'electronics', priority: 'essential', reason: 'Keep devices charged' },
  { item: 'Power adapter', category: 'electronics', priority: 'essential', reason: 'Different outlet standards' },
  { item: 'Prescription medications', category: 'toiletries', priority: 'essential', reason: 'Health essentials' },
  { item: 'First aid basics', category: 'toiletries', priority: 'recommended', reason: 'Minor emergencies' },
  { item: 'Comfortable walking shoes', category: 'footwear', priority: 'essential', reason: 'Daily exploration' },
  { item: 'Reusable water bottle', category: 'accessories', priority: 'recommended', reason: 'Stay hydrated' },
  { item: 'Day bag/crossbody', category: 'accessories', priority: 'essential', reason: 'Carry daily essentials' },
];

// =============================================================================
// DESTINATION-SPECIFIC ITEMS
// =============================================================================

const DESTINATION_ITEMS: Record<string, PackingItem[]> = {
  'japan': [
    { item: 'Pocket wifi/SIM card', category: 'electronics', priority: 'recommended', reason: 'Navigation in Japan' },
    { item: 'Cash (Yen)', category: 'documents', priority: 'essential', reason: 'Many places in Japan are cash-only' },
    { item: 'Handkerchief/towel', category: 'accessories', priority: 'recommended', reason: 'Public restrooms often lack paper towels' },
  ],
  'india': [
    { item: 'Modest clothing', category: 'clothing', priority: 'essential', reason: 'Cultural appropriateness' },
    { item: 'Hand sanitizer', category: 'toiletries', priority: 'essential', reason: 'Hygiene' },
    { item: 'Mosquito repellent', category: 'toiletries', priority: 'essential', reason: 'Insect protection' },
  ],
  'morocco': [
    { item: 'Modest clothing', category: 'clothing', priority: 'essential', reason: 'Cultural appropriateness' },
    { item: 'Scarf', category: 'accessories', priority: 'recommended', reason: 'Dust/sun protection and cultural sites' },
  ],
  'iceland': [
    { item: 'Waterproof layers', category: 'clothing', priority: 'essential', reason: 'Unpredictable weather' },
    { item: 'Thermal underwear', category: 'clothing', priority: 'essential', reason: 'Cold temperatures' },
    { item: 'Swimsuit', category: 'clothing', priority: 'essential', reason: 'Hot springs and geothermal pools' },
  ],
};

// =============================================================================
// MAIN FUNCTION
// =============================================================================

export function generatePackingSuggestions(
  activities: Array<{
    dayNumber: number;
    title: string;
    category: string;
    tags?: string[];
    description?: string;
  }>,
  destination: string,
  weatherCondition?: 'hot' | 'cold' | 'rain' | 'mild',
  tripDuration?: number
): PackingList {
  console.log(`[Packing] Generating suggestions for ${activities.length} activities in ${destination}`);
  
  const items: PackingItem[] = [];
  const seenItems = new Set<string>();
  const byDay = new Map<number, PackingItem[]>();
  const specialNotes: string[] = [];
  
  // Add universal items
  for (const item of UNIVERSAL_ITEMS) {
    if (!seenItems.has(item.item)) {
      items.push(item);
      seenItems.add(item.item);
    }
  }
  
  // Add destination-specific items
  const destLower = destination.toLowerCase();
  for (const [key, destItems] of Object.entries(DESTINATION_ITEMS)) {
    if (destLower.includes(key)) {
      for (const item of destItems) {
        if (!seenItems.has(item.item)) {
          items.push(item);
          seenItems.add(item.item);
        }
      }
    }
  }
  
  // Add weather-specific items
  if (weatherCondition && ACTIVITY_PACKING_RULES[weatherCondition]) {
    for (const item of ACTIVITY_PACKING_RULES[weatherCondition]) {
      if (!seenItems.has(item.item)) {
        items.push(item);
        seenItems.add(item.item);
      }
    }
  }
  
  // Analyze activities and add items
  for (const activity of activities) {
    const activityItems = analyzeActivity(activity, seenItems);
    
    for (const item of activityItems) {
      if (!seenItems.has(item.item)) {
        item.forDays = [activity.dayNumber];
        item.forActivities = [activity.title];
        items.push(item);
        seenItems.add(item.item);
        
        // Add to day map
        if (!byDay.has(activity.dayNumber)) {
          byDay.set(activity.dayNumber, []);
        }
        byDay.get(activity.dayNumber)!.push(item);
      } else {
        // Update existing item with this day
        const existing = items.find(i => i.item === item.item);
        if (existing) {
          existing.forDays = [...(existing.forDays || []), activity.dayNumber];
          existing.forActivities = [...(existing.forActivities || []), activity.title];
        }
      }
    }
  }
  
  // Organize by category
  const byCategory = new Map<string, PackingItem[]>();
  for (const item of items) {
    if (!byCategory.has(item.category)) {
      byCategory.set(item.category, []);
    }
    byCategory.get(item.category)!.push(item);
  }
  
  // Add special notes based on patterns
  if (activities.some(a => a.category === 'dining' && a.title.toLowerCase().includes('fine'))) {
    specialNotes.push('Pack at least one smart casual outfit for fine dining experiences.');
  }
  if (activities.some(a => a.tags?.includes('temple') || a.tags?.includes('religious'))) {
    specialNotes.push('Modest clothing required for religious sites - pack items that cover shoulders and knees.');
  }
  if ((tripDuration || 0) > 7) {
    specialNotes.push('For a week+ trip, consider packing travel laundry supplies to pack lighter.');
  }
  
  // Build prompt section
  const promptSection = buildPackingPrompt(items, byCategory, specialNotes, destination);
  
  return {
    items,
    byCategory,
    byDay,
    specialNotes,
    promptSection,
  };
}

function analyzeActivity(
  activity: { title: string; category: string; tags?: string[]; description?: string },
  seenItems: Set<string>
): PackingItem[] {
  const items: PackingItem[] = [];
  const titleLower = activity.title.toLowerCase();
  const descLower = (activity.description || '').toLowerCase();
  const tags = activity.tags || [];
  
  // Check each packing rule
  for (const [keyword, packingItems] of Object.entries(ACTIVITY_PACKING_RULES)) {
    const matched = 
      titleLower.includes(keyword) ||
      descLower.includes(keyword) ||
      tags.some(t => t.toLowerCase().includes(keyword)) ||
      activity.category.toLowerCase().includes(keyword);
    
    if (matched) {
      for (const item of packingItems) {
        if (!seenItems.has(item.item)) {
          items.push({ ...item });
        }
      }
    }
  }
  
  return items;
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildPackingPrompt(
  items: PackingItem[],
  byCategory: Map<string, PackingItem[]>,
  specialNotes: string[],
  destination: string
): string {
  if (items.length === 0) return '';
  
  const essentials = items.filter(i => i.priority === 'essential');
  const recommended = items.filter(i => i.priority === 'recommended');
  
  let prompt = `## 🧳 PACKING SUGGESTIONS FOR ${destination.toUpperCase()}

Based on the activities in this itinerary, here's what to pack:

### ESSENTIALS
${essentials.slice(0, 10).map(i => `- ${i.item} (${i.reason})`).join('\n')}

### RECOMMENDED
${recommended.slice(0, 8).map(i => `- ${i.item} (${i.reason})`).join('\n')}
`;

  if (specialNotes.length > 0) {
    prompt += `
### SPECIAL NOTES
${specialNotes.map(n => `- ${n}`).join('\n')}
`;
  }

  return prompt;
}

// =============================================================================
// OUTPUT FORMATTER
// =============================================================================

export function formatPackingListForUI(list: PackingList): {
  essential: Array<{ item: string; reason: string }>;
  recommended: Array<{ item: string; reason: string }>;
  optional: Array<{ item: string; reason: string }>;
  activitySpecific: Array<{ activity: string; items: string[] }>;
} {
  return {
    essential: list.items
      .filter(i => i.priority === 'essential')
      .map(i => ({ item: i.item, reason: i.reason })),
    recommended: list.items
      .filter(i => i.priority === 'recommended')
      .map(i => ({ item: i.item, reason: i.reason })),
    optional: list.items
      .filter(i => i.priority === 'optional')
      .map(i => ({ item: i.item, reason: i.reason })),
    activitySpecific: [], // Could be enhanced to group by activity
  };
}
