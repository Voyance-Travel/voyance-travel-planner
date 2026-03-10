/**
 * Trip Type Modifiers - First-class input for itinerary generation
 * 
 * Trip type shapes WHAT you celebrate/focus on
 * Archetype shapes HOW they experience it
 * 
 * A birthday for a Slow Traveler ≠ a birthday for an Adrenaline Architect
 */

export interface TripTypeModifier {
  name: string;
  description: string;
  mustInclude: string[];
  atmosphere: string;
  promptAddition: string;
  frequency: Record<string, string | number | boolean>;
  pacingModifier?: number;
  bufferModifier?: number;
  maxActivitiesPerDay?: number;
  excludeCategories?: string[];
  overrideArchetypeFor?: string[];
  upgradeExperiences?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIP TYPE × ARCHETYPE INTERACTION MODEL
// ═══════════════════════════════════════════════════════════════════════════
// 
// The hierarchy:
// 1. TRIP TYPE sets WHAT (purpose, constraints, safety requirements)
// 2. ARCHETYPE determines HOW (style, expression within those constraints)
// 3. TRAITS fine-tune (exact calibration)
//
// Three interaction patterns:
// - OVERRIDE: Trip type overrides archetype behavior (safety, logistics)
// - COMBINE: Trip type requirements blend with archetype style
// - AMPLIFY: Trip type amplifies existing archetype tendencies
// ═══════════════════════════════════════════════════════════════════════════

export type InteractionType = 'override' | 'combine' | 'amplify' | 'neutral';

export interface ArchetypeInteraction {
  interaction: InteractionType;
  description: string;
  pacingModifier: number;
  priorityShift: string[];
  deprioritize: string[];
  hardConstraints?: string[];
}

/**
 * Complete interaction matrix for all trip types × archetypes
 * Defines HOW the trip type affects archetype behavior
 */
export const tripTypeArchetypeInteraction: Record<string, Record<string, ArchetypeInteraction>> = {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BABYMOON - Heavy OVERRIDE for pregnancy safety
  // ═══════════════════════════════════════════════════════════════════════════
  babymoon: {
    adrenaline_architect: {
      interaction: 'override',
      description: 'Adventure instincts fully overridden. Safety first. Scenic drives instead of activities.',
      pacingModifier: -4,
      priorityShift: ['rest', 'comfort', 'scenic viewing', 'prenatal spa'],
      deprioritize: ['adventure', 'physical challenges', 'strenuous activities'],
      hardConstraints: ['All activities must be pregnancy-safe', 'Maximum 1-2 activities per day', 'No adventure activities']
    },
    bucket_list_conqueror: {
      interaction: 'override',
      description: 'Must-see energy redirected to comfortable highlights only.',
      pacingModifier: -3,
      priorityShift: ['rest', 'scenic viewing', 'comfortable must-sees'],
      deprioritize: ['packed schedules', 'efficiency', 'marathon sightseeing'],
      hardConstraints: ['Maximum 2 easy activities per day', 'Include rest blocks']
    },
    wilderness_pioneer: {
      interaction: 'override',
      description: 'Outdoor energy redirected to gentle nature viewing, scenic drives.',
      pacingModifier: -4,
      priorityShift: ['scenic drives', 'gentle walks', 'nature viewing'],
      deprioritize: ['hiking', 'camping', 'strenuous outdoors'],
      hardConstraints: ['No strenuous outdoor activities', 'Pregnancy-safe only']
    },
    slow_traveler: {
      interaction: 'amplify',
      description: 'Natural match. Extra slow. Maximum rest. Perfect fit.',
      pacingModifier: -1,
      priorityShift: ['rest', 'comfort', 'prenatal pampering'],
      deprioritize: []
    },
    beach_therapist: {
      interaction: 'amplify',
      description: 'Beach + pregnancy = perfect. Gentle swimming, lounging, rest.',
      pacingModifier: -1,
      priorityShift: ['beach lounging', 'gentle swimming', 'shade'],
      deprioritize: ['water sports']
    },
    retreat_regular: {
      interaction: 'amplify',
      description: 'Spa focus with prenatal treatments. Peak babymoon experience.',
      pacingModifier: -1,
      priorityShift: ['prenatal spa', 'wellness', 'rest'],
      deprioritize: []
    },
    zen_seeker: {
      interaction: 'amplify',
      description: 'Peaceful preparation for parenthood. Meditation, gentle yoga.',
      pacingModifier: -1,
      priorityShift: ['prenatal yoga', 'meditation', 'spiritual preparation'],
      deprioritize: []
    },
    culinary_cartographer: {
      interaction: 'combine',
      description: 'Food focus maintained but pregnancy-safe options only.',
      pacingModifier: -2,
      priorityShift: ['pregnancy-safe dining', 'gentle food tours', 'seated experiences'],
      deprioritize: ['raw fish', 'alcohol-focused venues', 'long walking food tours'],
      hardConstraints: ['All restaurants must have pregnancy-safe options', 'No raw fish focus']
    },
    luxury_luminary: {
      interaction: 'combine',
      description: 'Luxury with prenatal pampering. Premium comfort for two.',
      pacingModifier: -2,
      priorityShift: ['luxury prenatal spa', 'premium comfort', 'room service option'],
      deprioritize: ['strenuous VIP experiences']
    },
    // Default for all other archetypes
    _default: {
      interaction: 'override',
      description: 'Pregnancy safety overrides all other preferences.',
      pacingModifier: -3,
      priorityShift: ['rest', 'comfort', 'pregnancy-safe activities'],
      deprioritize: ['adventure', 'strenuous activities', 'packed schedules'],
      hardConstraints: ['All activities pregnancy-safe', 'Maximum 2 activities per day', 'Daily rest blocks required']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FAMILY - Override for kid logistics and timing
  // ═══════════════════════════════════════════════════════════════════════════
  family: {
    bucket_list_conqueror: {
      interaction: 'override',
      description: 'Must-see list filtered through kid lens. Fewer sites, more time each.',
      pacingModifier: -2,
      priorityShift: ['kid-friendly highlights', 'interactive sites', 'family must-sees'],
      deprioritize: ['marathon sightseeing', 'adult museums', 'packed schedules'],
      hardConstraints: ['Max 2-3 activities per day', 'Include rest time 13:00-15:00']
    },
    adrenaline_architect: {
      interaction: 'combine',
      description: 'Adventure channeled into age-appropriate thrills. Water parks, easy hikes.',
      pacingModifier: -2,
      priorityShift: ['kid-friendly adventure', 'family activities', 'age-appropriate thrills'],
      deprioritize: ['extreme sports', 'adult-only adventures'],
      hardConstraints: ['All activities must be age-appropriate']
    },
    slow_traveler: {
      interaction: 'amplify',
      description: 'Slow pace matches kid pace naturally. Extra rest time.',
      pacingModifier: 0,
      priorityShift: ['rest time', 'playground breaks', 'relaxed kid pace'],
      deprioritize: []
    },
    culinary_cartographer: {
      interaction: 'combine',
      description: 'Food focus with kid-friendly execution. Cooking classes, food markets.',
      pacingModifier: -1,
      priorityShift: ['family cooking class', 'kid-friendly food', 'casual dining'],
      deprioritize: ['fine dining', 'long tasting menus', 'late dinners'],
      hardConstraints: ['Dinner by 18:30', 'Lunch by 13:00']
    },
    luxury_luminary: {
      interaction: 'combine',
      description: 'Luxury family experience. Best family resorts, kids clubs, family suites.',
      pacingModifier: -1,
      priorityShift: ['luxury family resort', 'kids club', 'family VIP experiences'],
      deprioritize: ['adults-only venues']
    },
    social_butterfly: {
      interaction: 'combine',
      description: 'Social family trip. Activities with other families, kid-friendly group tours.',
      pacingModifier: -1,
      priorityShift: ['family group activities', 'meeting other families'],
      deprioritize: ['nightlife', 'adult social scenes']
    },
    _default: {
      interaction: 'override',
      description: 'Kid logistics override normal preferences. Meal times, rest blocks, early evenings.',
      pacingModifier: -2,
      priorityShift: ['kid-friendly activities', 'rest blocks', 'early dining'],
      deprioritize: ['adult-only', 'late nights', 'fine dining'],
      hardConstraints: ['Lunch by 13:00', 'Dinner by 18:30', 'Rest time 13:00-15:00', 'Max 2-3 activities per day']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HONEYMOON - Combine romance with style, override for rest
  // ═══════════════════════════════════════════════════════════════════════════
  honeymoon: {
    adrenaline_architect: {
      interaction: 'combine',
      description: 'Adventure romance. Shared thrills build memories. But include rest.',
      pacingModifier: -1,
      priorityShift: ['couples adventure', 'romantic settings', 'recovery time', 'shared thrills'],
      deprioritize: ['solo challenges', 'extreme intensity', 'back-to-back adventures']
    },
    slow_traveler: {
      interaction: 'amplify',
      description: 'Ultimate slow romance. Long meals, no rushing, savoring newlywed time.',
      pacingModifier: -1,
      priorityShift: ['romantic lingering', 'quality time', 'long meals'],
      deprioritize: []
    },
    bucket_list_conqueror: {
      interaction: 'combine',
      description: 'Dream destination with romantic lens. Must-sees with couple time.',
      pacingModifier: -1,
      priorityShift: ['romantic must-sees', 'couple experiences', 'buffer time'],
      deprioritize: ['marathon efficiency', 'solo sightseeing']
    },
    culinary_cartographer: {
      interaction: 'combine',
      description: 'Food honeymoon. Cooking classes together, romantic dinners.',
      pacingModifier: -1,
      priorityShift: ['couples cooking class', 'romantic restaurants', 'food experiences together'],
      deprioritize: ['solo counter dining']
    },
    beach_therapist: {
      interaction: 'amplify',
      description: 'Beach honeymoon. Ultimate relaxation, ocean sunsets, simple romance.',
      pacingModifier: -1,
      priorityShift: ['beach romance', 'sunset moments', 'couples lounging'],
      deprioritize: []
    },
    luxury_luminary: {
      interaction: 'amplify',
      description: 'Luxury honeymoon. Five-star everything, private experiences, premium romance.',
      pacingModifier: -1,
      priorityShift: ['VIP couples experiences', 'premium romance', 'private moments'],
      deprioritize: []
    },
    social_butterfly: {
      interaction: 'combine',
      description: 'Social honeymoon but couples-focused. Classes with other couples.',
      pacingModifier: -1,
      priorityShift: ['couples activities', 'small group experiences', 'meeting other newlyweds'],
      deprioritize: ['singles social', 'party scenes']
    },
    _default: {
      interaction: 'combine',
      description: 'Romance threads through archetype style. Rest for post-wedding exhaustion.',
      pacingModifier: -2,
      priorityShift: ['romantic experiences', 'couples activities', 'rest time'],
      deprioritize: ['solo activities', 'group tours with strangers'],
      hardConstraints: ['Include daily rest blocks', 'At least 2 romantic dinners', 'Late start times (10am+)']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WELLNESS RETREAT - Override for wellness focus
  // ═══════════════════════════════════════════════════════════════════════════
  wellness_retreat: {
    retreat_regular: {
      interaction: 'amplify',
      description: 'Dream trip. Full immersion. Daily treatments. Total reset.',
      pacingModifier: -1,
      priorityShift: ['comprehensive wellness', 'daily treatments', 'full programs'],
      deprioritize: []
    },
    zen_seeker: {
      interaction: 'amplify',
      description: 'Spiritual wellness. Meditation intensive. Inner journey.',
      pacingModifier: -1,
      priorityShift: ['meditation', 'spiritual practices', 'silence'],
      deprioritize: []
    },
    adrenaline_architect: {
      interaction: 'override',
      description: 'Active wellness. Challenging yoga, fitness retreat, athletic recovery.',
      pacingModifier: -2,
      priorityShift: ['active wellness', 'fitness classes', 'challenging yoga'],
      deprioritize: ['adventure activities', 'thrills', 'adrenaline'],
      hardConstraints: ['All activities must be wellness-focused']
    },
    bucket_list_conqueror: {
      interaction: 'override',
      description: 'Wellness goals instead of sightseeing. Complete a program.',
      pacingModifier: -2,
      priorityShift: ['wellness achievements', 'program completion', 'health goals'],
      deprioritize: ['tourist attractions', 'sightseeing', 'packed schedules'],
      hardConstraints: ['Wellness dominates every day']
    },
    culinary_cartographer: {
      interaction: 'override',
      description: 'Nutrition wellness. Healthy cooking, food as medicine.',
      pacingModifier: -2,
      priorityShift: ['healthy eating', 'nutrition classes', 'clean dining'],
      deprioritize: ['indulgent dining', 'multi-course meals', 'alcohol'],
      hardConstraints: ['All dining must be health-focused']
    },
    slow_traveler: {
      interaction: 'amplify',
      description: 'Slow wellness. Unhurried treatments, mindful pace.',
      pacingModifier: -1,
      priorityShift: ['unhurried wellness', 'integration time'],
      deprioritize: []
    },
    _default: {
      interaction: 'override',
      description: 'Wellness is the purpose. All activities filtered through wellness lens.',
      pacingModifier: -3,
      priorityShift: ['daily wellness practice', 'treatments', 'healthy dining', 'rest'],
      deprioritize: ['sightseeing', 'adventure', 'packed schedules', 'indulgent dining'],
      hardConstraints: ['Morning practice daily', 'At least one treatment per day', 'Health-focused dining', 'Very slow pacing']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADVENTURE - Override activity selection, amplify active archetypes
  // ═══════════════════════════════════════════════════════════════════════════
  adventure: {
    adrenaline_architect: {
      interaction: 'amplify',
      description: 'Dream trip. Maximum adventure. Expert level. Full send.',
      pacingModifier: +1,
      priorityShift: ['extreme activities', 'challenges', 'adrenaline', 'expert level'],
      deprioritize: ['rest', 'museums', 'relaxation']
    },
    wilderness_pioneer: {
      interaction: 'amplify',
      description: 'Outdoor adventure focus. Multi-day treks. Expedition style.',
      pacingModifier: +1,
      priorityShift: ['outdoor adventure', 'nature challenges', 'expedition'],
      deprioritize: ['urban', 'relaxation']
    },
    slow_traveler: {
      interaction: 'override',
      description: 'Gentle adventure. Hiking not climbing. Accessible thrills.',
      pacingModifier: +1,
      priorityShift: ['accessible adventure', 'scenic active', 'gentle thrills'],
      deprioritize: ['extreme', 'strenuous', 'multi-hour hikes']
    },
    culinary_cartographer: {
      interaction: 'combine',
      description: 'Adventure eating. Foraging, extreme food, adventure + fuel.',
      pacingModifier: +1,
      priorityShift: ['adventurous eating', 'foraging', 'fuel-focused dining'],
      deprioritize: ['fine dining', 'long seated meals']
    },
    luxury_luminary: {
      interaction: 'combine',
      description: 'Luxury adventure. Heli-skiing, private guides, premium thrills.',
      pacingModifier: 0,
      priorityShift: ['premium adventure', 'VIP experiences', 'private guides'],
      deprioritize: ['budget options', 'group tours']
    },
    beach_therapist: {
      interaction: 'override',
      description: 'Water adventure. Surfing, diving, kayaking. Active beach.',
      pacingModifier: +1,
      priorityShift: ['water sports', 'active beach', 'ocean adventure'],
      deprioritize: ['lounging', 'passive beach time']
    },
    _default: {
      interaction: 'override',
      description: 'Adventure is the purpose. 60%+ of activities must be adventure-focused.',
      pacingModifier: +1,
      priorityShift: ['adventure activities', 'active experiences', 'physical challenges'],
      deprioritize: ['relaxation', 'museums', 'shopping', 'passive activities'],
      hardConstraints: ['Adventure activity every day', 'Include recovery blocks', 'Fuel-focused dining']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FOODIE - Override for food focus, maintain dining style
  // ═══════════════════════════════════════════════════════════════════════════
  foodie: {
    culinary_cartographer: {
      interaction: 'amplify',
      description: 'Dream trip. Food is 90% of experience. Expert level.',
      pacingModifier: -1,
      priorityShift: ['signature restaurants', 'expert food experiences', 'food deep dive'],
      deprioritize: ['non-food activities']
    },
    slow_traveler: {
      interaction: 'amplify',
      description: 'Slow food pilgrimage. 3-hour meals. Savoring.',
      pacingModifier: -1,
      priorityShift: ['long meals', 'unhurried dining', 'food appreciation'],
      deprioritize: ['quick bites']
    },
    adrenaline_architect: {
      interaction: 'combine',
      description: 'Food adventure. Extreme cuisine, bizarre foods, challenges.',
      pacingModifier: 0,
      priorityShift: ['adventurous eating', 'food challenges', 'extreme cuisine'],
      deprioritize: ['safe choices', 'familiar food']
    },
    bucket_list_conqueror: {
      interaction: 'combine',
      description: 'Bucket list restaurants. THE places. Michelin stars.',
      pacingModifier: 0,
      priorityShift: ['bucket list restaurants', 'famous chefs', 'legendary meals'],
      deprioritize: ['unknown spots']
    },
    luxury_luminary: {
      interaction: 'amplify',
      description: 'Luxury foodie. Michelin stars, tasting menus, chef tables.',
      pacingModifier: -1,
      priorityShift: ['Michelin dining', 'chef experiences', 'premium food'],
      deprioritize: ['casual dining']
    },
    gap_year_graduate: {
      interaction: 'combine',
      description: 'Budget foodie. Street food mastery, markets, cheap eats excellence.',
      pacingModifier: 0,
      priorityShift: ['street food', 'markets', 'value dining', 'local cheap eats'],
      deprioritize: ['expensive restaurants']
    },
    _default: {
      interaction: 'override',
      description: 'Food is the purpose. 60%+ of itinerary must be food-focused.',
      pacingModifier: -1,
      priorityShift: ['market visits', 'cooking classes', 'signature restaurants', 'food discovery'],
      deprioritize: ['non-food activities', 'quick meals'],
      hardConstraints: ['Every meal is intentional', 'Include market visit', 'Include cooking class or food activity', '2+ hours for main meals']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOLO - Combine with social calibration from archetype
  // ═══════════════════════════════════════════════════════════════════════════
  solo: {
    social_butterfly: {
      interaction: 'combine',
      description: 'Solo but social. Tours, hostels, pub crawls to meet people.',
      pacingModifier: 0,
      priorityShift: ['social activities', 'group tours', 'meeting travelers', 'communal dining'],
      deprioritize: ['isolated experiences', 'private activities']
    },
    gap_year_graduate: {
      interaction: 'combine',
      description: 'Classic solo backpacking. Hostels, meeting travelers, budget social.',
      pacingModifier: 0,
      priorityShift: ['hostel social', 'backpacker activities', 'pub crawls', 'free tours'],
      deprioritize: ['expensive solo', 'isolating luxury']
    },
    zen_seeker: {
      interaction: 'amplify',
      description: 'Solo spiritual journey. Solitude is the practice.',
      pacingModifier: 0,
      priorityShift: ['solitude', 'meditation', 'silence', 'inner focus'],
      deprioritize: ['social activities', 'crowds', 'noise']
    },
    healing_journeyer: {
      interaction: 'amplify',
      description: 'Solo healing. Solitude as medicine. Space to feel.',
      pacingModifier: 0,
      priorityShift: ['peaceful activities', 'nature', 'journaling time', 'gentle pace'],
      deprioritize: ['forced social', 'crowds', 'intense activities']
    },
    flexible_wanderer: {
      interaction: 'amplify',
      description: 'Peak freedom. Zero compromise. This is what solo is for.',
      pacingModifier: 0,
      priorityShift: ['flexibility', 'spontaneity', 'unscheduled time', 'freedom'],
      deprioritize: ['fixed plans', 'rigid schedules']
    },
    culinary_cartographer: {
      interaction: 'combine',
      description: 'Solo food journey. Counter seating, food tours, markets.',
      pacingModifier: 0,
      priorityShift: ['solo-friendly dining', 'counter seats', 'food tours', 'markets'],
      deprioritize: ['romantic restaurants', 'couples tables']
    },
    slow_traveler: {
      interaction: 'amplify',
      description: 'Solo savoring. Alone is the point. Your pace exactly.',
      pacingModifier: 0,
      priorityShift: ['cafes with books', 'long solo lunches', 'museums alone', 'parks'],
      deprioritize: ['group tours', 'social activities']
    },
    _default: {
      interaction: 'combine',
      description: 'Solo experience calibrated to archetype social level.',
      pacingModifier: 0,
      priorityShift: ['solo-friendly venues', 'freedom blocks', 'flexibility'],
      deprioritize: ['couples activities', 'romantic venues', 'partner-required'],
      hardConstraints: ['All restaurants must be solo-friendly', 'Include unstructured time', 'Celebrate solo travel']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GUYS TRIP - Combine with group energy
  // ═══════════════════════════════════════════════════════════════════════════
  guys_trip: {
    adrenaline_architect: {
      interaction: 'amplify',
      description: 'Adventure guys trip. Group challenges, shared thrills.',
      pacingModifier: 0,
      priorityShift: ['group adventure', 'shared challenges', 'team activities'],
      deprioritize: ['solo activities', 'quiet experiences']
    },
    slow_traveler: {
      interaction: 'combine',
      description: 'Relaxed guys trip. Long meals, craft beer, no rushing.',
      pacingModifier: -1,
      priorityShift: ['long group meals', 'beer tastings', 'quality hang time'],
      deprioritize: ['packed schedule', 'rushing anywhere']
    },
    culinary_cartographer: {
      interaction: 'combine',
      description: 'Foodie guys trip. Brewery tours, BBQ, food crawls.',
      pacingModifier: 0,
      priorityShift: ['group food experiences', 'shareable food', 'brewery tours', 'BBQ'],
      deprioritize: ['tasting menus', 'quiet fine dining']
    },
    flexible_wanderer: {
      interaction: 'combine',
      description: 'Spontaneous guys trip. Discover bars together, follow energy.',
      pacingModifier: 0,
      priorityShift: ['group spontaneity', 'bar discoveries', 'following vibes'],
      deprioritize: ['rigid plans', 'strict schedules']
    },
    luxury_luminary: {
      interaction: 'combine',
      description: 'VIP guys trip. Premium experiences, exclusive access.',
      pacingModifier: 0,
      priorityShift: ['VIP experiences', 'premium venues', 'exclusive access'],
      deprioritize: ['budget options']
    },
    _default: {
      interaction: 'combine',
      description: 'Group bonding with archetype style applied.',
      pacingModifier: 0,
      priorityShift: ['group activities', 'bonding experiences', 'shared meals', 'evening entertainment'],
      deprioritize: ['solo activities', 'romantic venues', 'couples experiences'],
      hardConstraints: ['At least one group bonding activity', 'At least one evening/bar option', 'Group-friendly dining']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GIRLS TRIP - Combine with group energy
  // ═══════════════════════════════════════════════════════════════════════════
  girls_trip: {
    retreat_regular: {
      interaction: 'amplify',
      description: 'Spa girls trip. Group treatments, wellness together.',
      pacingModifier: -1,
      priorityShift: ['group spa', 'wellness activities', 'pampering together'],
      deprioritize: ['solo treatments']
    },
    adrenaline_architect: {
      interaction: 'combine',
      description: 'Adventure girls trip. Surfing, hiking together.',
      pacingModifier: 0,
      priorityShift: ['group adventure', 'shared challenges', 'active experiences'],
      deprioritize: ['solo activities']
    },
    culinary_cartographer: {
      interaction: 'combine',
      description: 'Foodie girls trip. Wine tasting, cooking class, brunch.',
      pacingModifier: 0,
      priorityShift: ['group food experiences', 'wine tasting', 'cooking class', 'brunch'],
      deprioritize: ['solo dining', 'counter seats']
    },
    slow_traveler: {
      interaction: 'combine',
      description: 'Leisurely girls trip. Long brunches, shopping, quality time.',
      pacingModifier: -1,
      priorityShift: ['long meals', 'relaxed shopping', 'quality girlfriend time'],
      deprioritize: ['packed schedule', 'rushing']
    },
    luxury_luminary: {
      interaction: 'amplify',
      description: 'Luxury girls trip. Spa, fine dining, champagne everything.',
      pacingModifier: 0,
      priorityShift: ['luxury spa', 'fine dining', 'champagne experiences'],
      deprioritize: ['budget options']
    },
    _default: {
      interaction: 'combine',
      description: 'Group experiences with archetype style applied.',
      pacingModifier: 0,
      priorityShift: ['photo-worthy experiences', 'brunch', 'group activities', 'evening out'],
      deprioritize: ['solo activities', 'romantic venues'],
      hardConstraints: ['At least one photo-worthy experience', 'Include brunch', 'Group-friendly dining', 'Evening out option']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BIRTHDAY - Combine celebration with archetype style
  // ═══════════════════════════════════════════════════════════════════════════
  birthday: {
    slow_traveler: {
      interaction: 'combine',
      description: 'One perfect leisurely birthday meal. No fuss celebration.',
      pacingModifier: 0,
      priorityShift: ['quality birthday meal', 'unhurried celebration'],
      deprioritize: ['birthday overload', 'multiple celebrations']
    },
    adrenaline_architect: {
      interaction: 'combine',
      description: 'Birthday adventure. That activity they have always wanted.',
      pacingModifier: 0,
      priorityShift: ['birthday bucket list activity', 'adventure celebration'],
      deprioritize: ['fancy dinner if not their thing']
    },
    social_butterfly: {
      interaction: 'combine',
      description: 'Birthday party. Group celebration, energy.',
      pacingModifier: 0,
      priorityShift: ['group celebration', 'party energy', 'festive atmosphere'],
      deprioritize: ['quiet intimate']
    },
    zen_seeker: {
      interaction: 'combine',
      description: 'Meaningful birthday. Peaceful celebration, reflection.',
      pacingModifier: 0,
      priorityShift: ['meaningful moment', 'peaceful celebration', 'reflection'],
      deprioritize: ['party', 'crowds', 'noise']
    },
    luxury_luminary: {
      interaction: 'combine',
      description: 'VIP birthday. Champagne, upgrades, the works.',
      pacingModifier: 0,
      priorityShift: ['VIP treatment', 'champagne', 'premium everything'],
      deprioritize: ['budget options']
    },
    culinary_cartographer: {
      interaction: 'combine',
      description: 'Birthday at THE restaurant. Food-focused celebration.',
      pacingModifier: 0,
      priorityShift: ['signature birthday dinner', 'special restaurant'],
      deprioritize: ['generic dining']
    },
    _default: {
      interaction: 'combine',
      description: 'Celebration styled to archetype. ONE special moment, not birthday overload.',
      pacingModifier: 0,
      priorityShift: ['birthday dinner', 'celebration moment'],
      deprioritize: ['generic activities'],
      hardConstraints: ['ONE special birthday dinner (not every meal)', 'ONE birthday moment/surprise', 'Personalized to archetype']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANNIVERSARY - Combine romance with archetype style
  // ═══════════════════════════════════════════════════════════════════════════
  anniversary: {
    slow_traveler: {
      interaction: 'combine',
      description: 'Slow romance. Long anniversary dinner, no rush.',
      pacingModifier: 0,
      priorityShift: ['romantic lingering', 'long special dinner'],
      deprioritize: ['rushing']
    },
    adrenaline_architect: {
      interaction: 'combine',
      description: 'Adventure anniversary. Shared thrills, romantic adventure.',
      pacingModifier: 0,
      priorityShift: ['couples adventure', 'romantic settings', 'shared challenges'],
      deprioritize: ['extreme solo challenges']
    },
    culinary_cartographer: {
      interaction: 'combine',
      description: 'Food anniversary. Cooking class together, special restaurant.',
      pacingModifier: 0,
      priorityShift: ['couples cooking class', 'anniversary dinner', 'food experiences together'],
      deprioritize: []
    },
    luxury_luminary: {
      interaction: 'amplify',
      description: 'Luxury anniversary. Five-star everything, private experiences.',
      pacingModifier: 0,
      priorityShift: ['premium romance', 'private experiences', 'VIP treatment'],
      deprioritize: []
    },
    beach_therapist: {
      interaction: 'combine',
      description: 'Beach anniversary. Ocean sunsets, simple romance.',
      pacingModifier: 0,
      priorityShift: ['beach romance', 'sunset moments', 'seaside dining'],
      deprioritize: []
    },
    _default: {
      interaction: 'combine',
      description: 'Romance styled to archetype. Celebrating the milestone together.',
      pacingModifier: 0,
      priorityShift: ['special anniversary dinner', 'romantic moment', 'couples activities'],
      deprioritize: ['solo activities', 'group tours'],
      hardConstraints: ['At least one romantic dinner', 'At least one romantic moment/setting', 'Acknowledge the celebration']
    }
  }
};

/**
 * Get the interaction rules for a specific trip type × archetype combination
 */
export function getArchetypeInteraction(tripType: string, archetype: string): ArchetypeInteraction | null {
  const normalizedTripType = tripType?.toLowerCase().replace(/[\s-]+/g, '_') || 'none';
  const normalizedArchetype = archetype?.toLowerCase().replace(/[\s-]+/g, '_') || '';
  
  const tripTypeRules = tripTypeArchetypeInteraction[normalizedTripType];
  if (!tripTypeRules) return null;
  
  // Check for specific archetype rule, fall back to _default
  return tripTypeRules[normalizedArchetype] || tripTypeRules['_default'] || null;
}

/**
 * Build the interaction prompt section that explains HOW trip type affects archetype
 */
export function buildInteractionPrompt(tripType: string, archetype: string, basePace: number): string {
  const interaction = getArchetypeInteraction(tripType, archetype);
  if (!interaction) return '';
  
  const effectivePace = basePace + interaction.pacingModifier;
  
  let prompt = `
═══════════════════════════════════════════════════════════════════════════
TRIP TYPE × ARCHETYPE INTERACTION
═══════════════════════════════════════════════════════════════════════════

Interaction Type: ${interaction.interaction.toUpperCase()}
${interaction.description}

=== EFFECTIVE PACING ===
Base pace: ${basePace}
Trip type modifier: ${interaction.pacingModifier > 0 ? '+' : ''}${interaction.pacingModifier}
Effective pace: ${effectivePace}
`;

  if (interaction.priorityShift.length > 0) {
    prompt += `
=== PRIORITIZE (move to top of experience list) ===
${interaction.priorityShift.map(p => `• ${p}`).join('\n')}
`;
  }

  if (interaction.deprioritize.length > 0) {
    prompt += `
=== DEPRIORITIZE (move down or remove) ===
${interaction.deprioritize.map(d => `• ${d}`).join('\n')}
`;
  }

  if (interaction.hardConstraints && interaction.hardConstraints.length > 0) {
    prompt += `
=== HARD CONSTRAINTS (cannot be violated) ===
${interaction.hardConstraints.map(c => `✗ ${c}`).join('\n')}
`;
  }

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOLO SOCIAL CALIBRATION - Different solo travelers have VERY different needs
// ═══════════════════════════════════════════════════════════════════════════

export interface SoloSocialCalibration {
  socialLevel: 'high' | 'medium' | 'low' | 'solitude';
  description: string;
  include: string[];
  avoid: string[];
}

export const soloSocialCalibration: Record<string, SoloSocialCalibration> = {
  // ─────────────────────────────────────────────────────────────────────────
  // HIGH SOCIAL - wants to meet people
  // ─────────────────────────────────────────────────────────────────────────
  social_butterfly: {
    socialLevel: 'high',
    description: 'Solo but SOCIAL - wants to meet people',
    include: [
      'Walking tours (meet other travelers)',
      'Pub crawls',
      'Hostel social events',
      'Cooking classes with communal tables',
      'Group food tours',
      'Bar seating where you can chat',
      'Communal dining experiences',
      'Group day trips'
    ],
    avoid: [
      'Solitary activities',
      'Private experiences',
      'Isolated restaurants'
    ]
  },

  gap_year_graduate: {
    socialLevel: 'high',
    description: 'Classic backpacker solo - hostels, meeting travelers',
    include: [
      'Hostel with good social scene',
      'Free walking tours',
      'Pub crawls',
      'Backpacker bars',
      'Group activities',
      'Communal kitchen cooking'
    ],
    avoid: [
      'Expensive solo experiences',
      'Isolating luxury'
    ]
  },

  community_builder: {
    socialLevel: 'high',
    description: 'Solo but connecting - meaningful interactions',
    include: [
      'Volunteering opportunities',
      'Community events',
      'Local meetups',
      'Walking tours with conversation',
      'Cooking classes',
      'Workshops with locals'
    ],
    avoid: [
      'Purely solo experiences',
      'Tourist traps'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MEDIUM SOCIAL - open to meeting people but not seeking it
  // ─────────────────────────────────────────────────────────────────────────
  flexible_wanderer: {
    socialLevel: 'medium',
    description: 'Solo freedom with optional social',
    include: [
      'Activities that work alone OR social',
      'Cafes where you might chat or not',
      'Walking tours (can engage or just follow)',
      'Markets (social but independent)'
    ],
    avoid: [
      'Forced group bonding',
      'Structured social activities'
    ]
  },

  culinary_cartographer: {
    socialLevel: 'medium',
    description: 'Food-focused solo - counter seating, food tours',
    include: [
      'Counter seating restaurants (natural solo spot)',
      'Food tours (social but food-focused)',
      'Cooking classes (communal)',
      'Chef\'s counter experiences',
      'Markets (independent grazing)'
    ],
    avoid: [
      'Romantic fine dining',
      'Couples cooking classes'
    ]
  },

  urban_nomad: {
    socialLevel: 'medium',
    description: 'City exploration solo - cafes, neighborhoods',
    include: [
      'Cafe culture (solo reading/working)',
      'Neighborhood walks',
      'Street food (easy solo)',
      'Bar counters',
      'Markets'
    ],
    avoid: [
      'Formal restaurants',
      'Forced group activities'
    ]
  },

  cultural_anthropologist: {
    socialLevel: 'medium',
    description: 'Deep solo immersion - own pace, local conversations',
    include: [
      'Museums at your pace',
      'Local neighborhood cafes',
      'Walking tours with optional chat',
      'Markets with vendors to talk to',
      'Historical sites to explore alone'
    ],
    avoid: [
      'Tourist groups that rush',
      'Cookie-cutter experiences'
    ]
  },

  bucket_list_conqueror: {
    socialLevel: 'medium',
    description: 'Solo bucket list - doing it MY way',
    include: [
      'Skip-the-line solo entry',
      'Self-paced landmark visits',
      'Photo spots (other tourists help with photos)',
      'Efficient solo dining'
    ],
    avoid: [
      'Slow group tours',
      'Activities requiring partners'
    ]
  },

  midlife_explorer: {
    socialLevel: 'medium',
    description: 'Solo rediscovery - meeting people optional',
    include: [
      'Quality solo experiences',
      'Nice restaurants with bar seating',
      'Small group tours',
      'Wine tastings (social but optional)'
    ],
    avoid: [
      'Youth hostel party scene',
      'Forced social activities'
    ]
  },

  digital_explorer: {
    socialLevel: 'medium',
    description: 'Solo but connected online - tech-friendly spaces',
    include: [
      'Great wifi cafes',
      'Co-working spaces',
      'Tech meetups (optional)',
      'Gaming cafes',
      'Solo-friendly unique experiences for content'
    ],
    avoid: [
      'Off-grid experiences',
      'No-wifi zones'
    ]
  },

  adrenaline_architect: {
    socialLevel: 'medium',
    description: 'Solo adventure - personal challenge',
    include: [
      'Solo-friendly adventure activities',
      'Self-guided hiking',
      'Activity centers that cater to individuals',
      'Challenges you can do alone'
    ],
    avoid: [
      'Tandem activities',
      'Partner-required experiences'
    ]
  },

  balanced_story_collector: {
    socialLevel: 'medium',
    description: 'Balanced solo - mix of everything',
    include: [
      'Mix of solo and group options',
      'Walking tours (optional engagement)',
      'Cafes, markets, museums',
      'Flexible dining options'
    ],
    avoid: [
      'Rigid group schedules',
      'Couples-only venues'
    ]
  },

  romantic_curator: {
    socialLevel: 'medium',
    description: 'Solo self-romance - treating yourself',
    include: [
      'Self-care experiences',
      'Nice dinners at bar seating',
      'Spa treatments solo',
      'Beautiful walks',
      'Self-dates to lovely venues'
    ],
    avoid: [
      'Obviously couples-only spots',
      'Romantic duo experiences'
    ]
  },

  family_architect: {
    socialLevel: 'medium',
    description: 'Parent escape - adult solo time',
    include: [
      'Adult-only experiences',
      'Sleep in, brunch alone',
      'Things you can\'t do with kids',
      'Peaceful meals',
      'Cultural experiences at your pace'
    ],
    avoid: [
      'Kid-focused venues',
      'Family activities (that\'s home)'
    ]
  },

  retirement_ranger: {
    socialLevel: 'medium',
    description: 'Solo retirement adventure - your terms',
    include: [
      'Comfortable solo dining',
      'Self-paced sightseeing',
      'Group tours (optional socializing)',
      'Accessible venues'
    ],
    avoid: [
      'Youth-focused venues',
      'Physical-demanding group activities'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LOW SOCIAL - comfortable alone, not seeking interaction
  // ─────────────────────────────────────────────────────────────────────────
  slow_traveler: {
    socialLevel: 'low',
    description: 'Solo savoring - alone is the point',
    include: [
      'Cafes with books',
      'Long solo lunches',
      'Museums at own pace',
      'Parks and gardens',
      'Quiet restaurants with good solo seating'
    ],
    avoid: [
      'Group tours',
      'Social activities',
      'Communal tables (unless wanted)'
    ]
  },

  art_aficionado: {
    socialLevel: 'low',
    description: 'Solo art immersion - own pace, no conversation',
    include: [
      'Museums (hours alone)',
      'Galleries (no one rushing you)',
      'Bookshops',
      'Cafe sketching',
      'Architecture walks (self-guided)'
    ],
    avoid: [
      'Group museum tours',
      'Chatty experiences'
    ]
  },

  sabbatical_scholar: {
    socialLevel: 'low',
    description: 'Solo learning - libraries, courses, thinking',
    include: [
      'Libraries',
      'Bookshops',
      'Lectures (listening, not socializing)',
      'Museums',
      'Cafes for reading/writing'
    ],
    avoid: [
      'Party scenes',
      'Social-focused activities'
    ]
  },

  collection_curator: {
    socialLevel: 'low',
    description: 'Solo deep dive - focused on interest, not people',
    include: [
      'Specialty museums',
      'Expert shops',
      'Focused experiences',
      'No distraction from passion'
    ],
    avoid: [
      'Generalist group tours',
      'Social activities unrelated to interest'
    ]
  },

  luxury_luminary: {
    socialLevel: 'low',
    description: 'Solo luxury - treating yourself',
    include: [
      'Chef\'s counter (premium solo spot)',
      'Spa (solo pampering)',
      'Private experiences',
      'Best tables (solo doesn\'t mean bad table)',
      'Concierge-arranged experiences'
    ],
    avoid: [
      'Group tours',
      'Budget social options'
    ]
  },

  status_seeker: {
    socialLevel: 'low',
    description: 'Solo prestige - VIP treatment for one',
    include: [
      'VIP experiences',
      'Premium solo seating',
      'Exclusive access',
      'Best of everything for one'
    ],
    avoid: [
      'Group budget options',
      'Shared experiences'
    ]
  },

  eco_ethicist: {
    socialLevel: 'low',
    description: 'Solo eco travel - nature and meaning',
    include: [
      'Nature experiences',
      'Sustainable venues',
      'Eco-lodges',
      'Conservation activities',
      'Quiet natural spaces'
    ],
    avoid: [
      'Crowded tourist spots',
      'Wasteful venues'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SOLITUDE SEEKING - alone time is the point
  // ─────────────────────────────────────────────────────────────────────────
  zen_seeker: {
    socialLevel: 'solitude',
    description: 'Solo spiritual journey - silence is golden',
    include: [
      'Meditation retreats',
      'Silent walks',
      'Temple visits (alone)',
      'Nature solitude',
      'Mindful solo dining'
    ],
    avoid: [
      'Group activities',
      'Social dining',
      'Noise',
      'Crowds'
    ]
  },

  healing_journeyer: {
    socialLevel: 'solitude',
    description: 'Solo healing - solitude as medicine',
    include: [
      'Nature alone',
      'Quiet cafes',
      'Gentle solo activities',
      'Journaling spots',
      'Peaceful walks'
    ],
    avoid: [
      'Forced social interaction',
      'Party scenes',
      'Crowded activities'
    ]
  },

  wilderness_pioneer: {
    socialLevel: 'solitude',
    description: 'Solo wilderness - self-reliance',
    include: [
      'Solo hiking',
      'Camping alone',
      'Nature immersion',
      'Wildlife watching',
      'Self-sufficient experiences'
    ],
    avoid: [
      'Group tours',
      'Social activities',
      'Urban experiences'
    ]
  },

  beach_therapist: {
    socialLevel: 'solitude',
    description: 'Solo beach - ocean therapy alone',
    include: [
      'Beach lounging (solo)',
      'Ocean swimming',
      'Sunset watching',
      'Casual beachside dining',
      'Reading by the water'
    ],
    avoid: [
      'Beach parties',
      'Group water sports',
      'Social beach clubs'
    ]
  },

  retreat_regular: {
    socialLevel: 'solitude',
    description: 'Solo wellness - personal restoration',
    include: [
      'Spa treatments',
      'Solo yoga',
      'Personal wellness',
      'Quiet healthy dining'
    ],
    avoid: [
      'Group wellness (unless wanted)',
      'Social retreats'
    ]
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// "OXYMORON" HANDLERS - Seemingly contradictory but REAL traveler combinations
// ═══════════════════════════════════════════════════════════════════════════
// These are NOT edge cases. These are real travelers who need real guidance.
// The system must recognize and properly handle these "contradictions."

export interface OxymoronHandler {
  combination: string;
  commonMisunderstanding: string;
  actualNeed: string;
  translationPrinciple: string;
  concreteExamples: string[];
  avoidMistakes: string[];
  diningGuidance?: string;
  sampleDay?: string;
}

export const oxymoronHandlers: OxymoronHandler[] = [

  // ═══════════════════════════════════════════════════════════════
  // SOLO COMBINATIONS - The "traveling alone but..." cases
  // ═══════════════════════════════════════════════════════════════

  {
    combination: 'solo + social_butterfly',
    commonMisunderstanding: 'Contradiction - social people travel with others',
    actualNeed: 'Travels alone but WANTS to meet people. Solo by circumstance or choice, social by nature.',
    translationPrinciple: 'Create opportunities for connection, not forced solitude',
    concreteExamples: [
      'Walking tours where they will meet other travelers',
      'Hostels with great social common areas (even if private room)',
      'Pub crawls and group activities',
      'Communal dining experiences',
      'Cooking classes with group tables',
      'Bar seating where conversation happens naturally',
      'Food tours with other participants',
      'Group day trips'
    ],
    avoidMistakes: [
      'Assuming they want solitude',
      'Private/isolated experiences',
      'Solo tables at restaurants',
      'Romantic solo framing ("table for one with a view")',
      'Language emphasizing aloneness'
    ],
    diningGuidance: 'Communal tables. Bar seating where conversation happens. Food tours with others.',
    sampleDay: 'Morning walking tour. Lunch with tour group. Hostel social hour. Pub crawl evening.'
  },

  {
    combination: 'solo + luxury_luminary',
    commonMisunderstanding: 'Sad rich person eating alone',
    actualNeed: 'Wants PREMIUM solo treatment. Not lonely, just traveling without compromise.',
    translationPrinciple: 'Solo does not mean lesser. Premium experience, party of one.',
    concreteExamples: [
      'Chef\'s counter (THE premium solo dining spot)',
      'Omakase experiences (intimate, solo-perfect)',
      'Spa treatments (solo pampering)',
      'Private tours (not group budget tours)',
      'Best seat in the house (not hidden away)',
      'Concierge-arranged experiences',
      'Premium hotel with excellent solo service',
      'VIP treatment without needing a +1'
    ],
    avoidMistakes: [
      'Budget alternatives because "you\'re just one person"',
      'Group tours to save money',
      'Assuming they want company',
      'Seating them at bad tables',
      'Treating solo as lesser-than'
    ],
    diningGuidance: 'Chef\'s counter. Omakase. Sommelier attention. Best seat, not hidden.',
    sampleDay: 'Late breakfast in bed. Spa. Shopping. Chef\'s counter dinner. Nightcap at top bar.'
  },

  {
    combination: 'solo + family_architect',
    commonMisunderstanding: 'Should be with family, not alone',
    actualNeed: 'Parent escaping for self-care. Remembering who they were before kids.',
    translationPrinciple: 'This is restoration, not abandonment. They NEED this.',
    concreteExamples: [
      'Sleep in (no kids waking them)',
      'Adult restaurants (no kids menu!)',
      'Uninterrupted museum time',
      'Reading on the beach alone',
      'Spa day without guilt',
      'Late dinners',
      'Activities they gave up for kids',
      'Quiet. So much quiet.'
    ],
    avoidMistakes: [
      'Kid-friendly anything',
      'Family references',
      'Guilt-inducing language',
      'Assuming they miss their kids constantly',
      'Suggesting they call home'
    ],
    diningGuidance: 'Adult restaurants. Late dinners. Wine. No kids menu in sight.',
    sampleDay: 'SLEEP IN. Long adult brunch. Museum alone. Spa. Late dinner with wine. Silence.'
  },

  {
    combination: 'solo + romantic_curator',
    commonMisunderstanding: 'Romance alone? That is sad.',
    actualNeed: 'Self-romance. Treating yourself. Self-love journey.',
    translationPrinciple: 'Romance with yourself is valid and beautiful.',
    concreteExamples: [
      'Nice dinners alone (good bar seating)',
      'Spa and self-care',
      'Beautiful hotels for yourself',
      'Scenic spots (sunset for one is still beautiful)',
      'Treating yourself to experiences',
      'Self-dates: bookshop, cafe, gallery',
      'Journaling spots',
      'Photography walks'
    ],
    avoidMistakes: [
      'Couples-focused venues',
      'Pity framing',
      '"Table for one?" with sad tone',
      'Assuming they wish they had a partner',
      'Romantic activities designed for two'
    ],
    diningGuidance: 'Nice restaurants with good bar seating. Treat yourself. No pity, no apology.',
    sampleDay: 'Leisurely morning. Art gallery solo date. Spa afternoon. Lovely dinner at bar.'
  },

  {
    combination: 'solo + healing_journeyer',
    commonMisunderstanding: 'Depressed person alone - is that safe?',
    actualNeed: 'Solitude AS healing. Space to process. Nature therapy.',
    translationPrinciple: 'Solitude is medicine, not isolation. Honor the need for space.',
    concreteExamples: [
      'Nature walks alone',
      'Quiet accommodations',
      'Journaling-friendly cafes',
      'Meditation spots',
      'Gentle solo activities',
      'No forced social interaction',
      'Peaceful environments',
      'Time and space to think'
    ],
    avoidMistakes: [
      'Forced social activities',
      'Checking if they are "okay" repeatedly',
      'Party atmospheres',
      'Crowded venues',
      'High-stimulation activities'
    ],
    diningGuidance: 'Quiet, nourishing. No pressure. Comfort food.',
    sampleDay: 'Gentle start. Nature walk. Quiet lunch. Journal. Rest. Early simple dinner.'
  },

  // ═══════════════════════════════════════════════════════════════
  // ADVENTURE COMBINATIONS - "Gentle thrill seekers"
  // ═══════════════════════════════════════════════════════════════

  {
    combination: 'adventure + slow_traveler',
    commonMisunderstanding: 'Lazy adventurer - contradiction',
    actualNeed: 'GENTLE adventure. Accessible thrills. Not extreme, but still active.',
    translationPrinciple: 'Adventure has a spectrum. Match intensity to preference.',
    concreteExamples: [
      'Scenic hiking (not mountaineering)',
      'Kayaking calm waters (not white water)',
      'Snorkeling (not scuba certification)',
      'Bike tours at leisure pace',
      'Wildlife watching (active but calm)',
      'Easy via ferrata',
      'Gentle surf lessons',
      'Nature walks with some challenge'
    ],
    avoidMistakes: [
      'Extreme activities',
      'Early morning departures',
      'Back-to-back adventures',
      'Competitive framing',
      'Pushing physical limits'
    ],
    diningGuidance: 'Fuel for gentle adventure. Relaxed post-activity meals.',
    sampleDay: 'Late start. Scenic moderate hike. Long lunch with views. Rest. Easy evening activity.'
  },

  {
    combination: 'adventure + luxury_luminary',
    commonMisunderstanding: 'Adventure is rugged and cheap',
    actualNeed: 'PREMIUM adventure. Best guides, best gear, best recovery.',
    translationPrinciple: 'Adventure + luxury is a huge market. Honor it.',
    concreteExamples: [
      'Heli-skiing',
      'Private guides (not group tours)',
      'Luxury safari',
      'Premium surf camp',
      'Yacht-based diving',
      'Five-star base camp',
      'Private climbing instruction',
      'Spa recovery after adventure'
    ],
    avoidMistakes: [
      'Budget group adventures',
      'Basic accommodations',
      'Shared equipment',
      'Rustic framing',
      'Assuming adventure = roughing it'
    ],
    diningGuidance: 'Premium recovery dining. Private chef. Fine dining after adventure.',
    sampleDay: 'Private guide adventure. Gourmet packed lunch. Spa recovery. Fine dining.'
  },

  {
    combination: 'adventure + healing_journeyer',
    commonMisunderstanding: 'They should rest, not adventure',
    actualNeed: 'Adventure AS therapy. Building confidence. Overcoming fears.',
    translationPrinciple: 'Physical challenge can be healing. Respect the journey.',
    concreteExamples: [
      'Confidence-building challenges',
      'Conquering fears (heights, water, etc.)',
      'Physical accomplishment',
      'Nature immersion',
      'Solo challenges with support',
      'Progressive difficulty',
      'Celebration of achievement'
    ],
    avoidMistakes: [
      'Only gentle activities',
      'Assuming they cannot handle challenge',
      'Overprotecting',
      'Not celebrating achievements'
    ],
    diningGuidance: 'Celebratory meals after achievements. Nourishing recovery food.',
    sampleDay: 'Confidence-building activity. Celebrate with good lunch. Rest. Reflect. Dinner.'
  },

  // ═══════════════════════════════════════════════════════════════
  // WELLNESS COMBINATIONS - "Active relaxers"
  // ═══════════════════════════════════════════════════════════════

  {
    combination: 'wellness_retreat + adrenaline_architect',
    commonMisunderstanding: 'Wellness = gentle, quiet, slow',
    actualNeed: 'ACTIVE wellness. Fitness retreat. Athletic recovery.',
    translationPrinciple: 'Wellness through physical challenge is valid.',
    concreteExamples: [
      'Fitness bootcamp retreats',
      'Challenging yoga (power, ashtanga)',
      'HIIT and strength training',
      'Athletic recovery protocols',
      'Sports massage',
      'High-altitude training',
      'Surf and yoga combo',
      'Endurance building'
    ],
    avoidMistakes: [
      'Only gentle/restorative options',
      'Assuming they want to slow down',
      'Passive treatments only',
      'Slow-paced programming'
    ],
    diningGuidance: 'Performance nutrition. Protein-focused. Athlete fuel.',
    sampleDay: 'Early HIIT class. Healthy power breakfast. Training. Sports massage. Protein dinner.'
  },

  {
    combination: 'wellness_retreat + culinary_cartographer',
    commonMisunderstanding: 'Food focus conflicts with wellness',
    actualNeed: 'Food AS wellness. Nutrition. Healthy gourmet. Medicine through meals.',
    translationPrinciple: 'Food and wellness are deeply connected. Honor both.',
    concreteExamples: [
      'Healthy cooking classes',
      'Nutrition education',
      'Farm-to-table wellness',
      'Ayurvedic cooking',
      'Juice cleanse (for those who want it)',
      'Mindful eating practices',
      'Healthy gourmet dining',
      'Food as medicine approach'
    ],
    avoidMistakes: [
      'Restriction/diet framing',
      'Ignoring food entirely',
      'Boring "health food"',
      'Guilt about eating'
    ],
    diningGuidance: 'Healthy gourmet. Food as medicine. Beautiful AND nutritious.',
    sampleDay: 'Morning practice. Healthy cooking class. Nutritious beautiful lunch. Treatment. Wellness dinner.'
  },

  {
    combination: 'wellness_retreat + bucket_list_conqueror',
    commonMisunderstanding: 'Wellness is passive, not achievement',
    actualNeed: 'Wellness ACHIEVEMENTS. Complete a program. Transform.',
    translationPrinciple: 'Some people want wellness with goals and outcomes.',
    concreteExamples: [
      'Complete a yoga teacher training',
      'Finish a detox program',
      'Master meditation technique',
      'Achieve flexibility goals',
      'Complete wellness certification',
      'Transformational retreat completion',
      'Measurable health outcomes'
    ],
    avoidMistakes: [
      'Open-ended, goalless wellness',
      'No structure or program',
      'Assuming they want to "just be"',
      'No achievement markers'
    ],
    diningGuidance: 'Program-aligned meals. Structured nutrition plan.',
    sampleDay: 'Program session. Structured lunch. Afternoon intensive. Progress tracking. Dinner.'
  },

  // ═══════════════════════════════════════════════════════════════
  // HONEYMOON COMBINATIONS - "Not your typical newlyweds"
  // ═══════════════════════════════════════════════════════════════

  {
    combination: 'honeymoon + gap_year_graduate',
    commonMisunderstanding: 'Honeymoons should be fancy',
    actualNeed: 'ROMANTIC on a budget. Love does not require luxury.',
    translationPrinciple: 'Special does not mean expensive. Meaningful romance.',
    concreteExamples: [
      'Budget romantic destinations',
      'Hostels with private rooms',
      'Street food romance',
      'Free romantic activities (beaches, sunsets, walks)',
      'One splurge meal, budget the rest',
      'Camping under stars',
      'Picnic romance',
      'Local experiences over tourist traps'
    ],
    avoidMistakes: [
      'Luxury assumptions',
      'Expensive restaurant pressure',
      'Making them feel cheap',
      'Only premium options'
    ],
    diningGuidance: 'Romantic budget finds. Street food for two. One special splurge.',
    sampleDay: 'Free beach morning. Picnic lunch. Explore together. Budget romantic dinner. Stars.'
  },

  {
    combination: 'honeymoon + adrenaline_architect',
    commonMisunderstanding: 'Honeymoons are spa and relaxation',
    actualNeed: 'Adventure ROMANCE. Bond through thrills, not just candles.',
    translationPrinciple: 'Shared adventure builds marriage foundation. Valid honeymoon style.',
    concreteExamples: [
      'Tandem skydiving',
      'Couples surf lessons',
      'Hiking to romantic viewpoints',
      'Scuba certification together',
      'Safari honeymoon',
      'Adventure by day, romance by night',
      'Shared challenges',
      'Story-building experiences'
    ],
    avoidMistakes: [
      'Only spa and beach',
      'Passive experiences',
      'Assuming they need to rest',
      'Separating adventure from romance'
    ],
    diningGuidance: 'Celebratory post-adventure dinners. Romance after the thrill.',
    sampleDay: 'Adventure activity together. Celebratory lunch. Rest. Romantic sunset. Special dinner.'
  },

  {
    combination: 'honeymoon + social_butterfly',
    commonMisunderstanding: 'Honeymoon should be private couple time',
    actualNeed: 'Some couples are SOCIAL. They want to meet other couples.',
    translationPrinciple: 'Not all romance is isolation. Social romance is valid.',
    concreteExamples: [
      'Cooking classes with other couples',
      'Group tours with romantic elements',
      'Boutique hotels with social atmosphere',
      'Wine tastings with others',
      'Resort with social programming',
      'Meeting other newlyweds',
      'Dinner with other travelers'
    ],
    avoidMistakes: [
      'Only private/isolated experiences',
      'Assuming they want to be alone',
      'No social options',
      'Hermit honeymoon'
    ],
    diningGuidance: 'Social romantic venues. Communal tables with couples. Wine events.',
    sampleDay: 'Couples activity with other couples. Social lunch. Pool with others. Group dinner.'
  },

  // ═══════════════════════════════════════════════════════════════
  // GUYS/GIRLS TRIP COMBINATIONS - "Not that kind of group"
  // ═══════════════════════════════════════════════════════════════

  {
    combination: 'guys_trip + zen_seeker',
    commonMisunderstanding: 'Guys trips are always party/sports',
    actualNeed: 'Wellness with the boys. Golf retreat. Meditation bros.',
    translationPrinciple: 'Male friendship has many forms. Honor the quiet version.',
    concreteExamples: [
      'Golf trip (sport + nature + bonding)',
      'Fishing trip (quiet bonding)',
      'Hiking trip (nature + challenge)',
      'Surf trip (active + meditative)',
      'Wellness retreat with guys',
      'Morning practice, afternoon hang',
      'Meaningful conversations over beer'
    ],
    avoidMistakes: [
      'Forcing party atmosphere',
      'Only bars and nightlife',
      'Assuming they want loud/wild',
      'No quiet options'
    ],
    diningGuidance: 'Quality over quantity. Good beer, good food, good conversation.',
    sampleDay: 'Morning golf/activity. Long quality lunch. Afternoon hang. Nice dinner with beers.'
  },

  {
    combination: 'guys_trip + slow_traveler',
    commonMisunderstanding: 'Guys trips need energy and action',
    actualNeed: 'Quality hang time. Long meals. No rushing.',
    translationPrinciple: 'Male bonding through presence, not just activity.',
    concreteExamples: [
      'Long lunches with beers',
      'Craft brewery tastings (not crawls)',
      'Quality restaurant, not quick bites',
      'Sitting and talking',
      'Golf (not rushed)',
      'One bar, good conversation',
      'No packed schedule'
    ],
    avoidMistakes: [
      'Back-to-back activities',
      'Pub CRAWL energy',
      'Rushing between things',
      'Assuming they want maximum action'
    ],
    diningGuidance: 'Long quality meals. Craft beer tastings. Time to talk.',
    sampleDay: 'Late start. Long leisurely activity. 3-hour lunch. Afternoon hang. Nice dinner.'
  },

  {
    combination: 'girls_trip + adrenaline_architect',
    commonMisunderstanding: 'Girls trips are spa and shopping',
    actualNeed: 'Adventure girls trip. Women want thrills too.',
    translationPrinciple: 'Adventure has no gender. Honor active women.',
    concreteExamples: [
      'Surfing together',
      'Hiking trip',
      'Zip-lining, bungee',
      'Diving certification',
      'Mountain biking',
      'Rock climbing',
      'Kayaking',
      'Adventure + evening celebrations'
    ],
    avoidMistakes: [
      'Only spa options',
      'Assuming shopping is priority',
      'Gentle/passive activities',
      'Pink-washing adventure'
    ],
    diningGuidance: 'Celebratory post-adventure meals. Recovery fuel. Fun dinners.',
    sampleDay: 'Adventure activity. Celebratory lunch. Rest. Pre-dinner drinks. Fun dinner out.'
  },

  {
    combination: 'girls_trip + zen_seeker',
    commonMisunderstanding: 'Girls trips are social/party',
    actualNeed: 'Peaceful girlfriend time. Meaningful connection over activity.',
    translationPrinciple: 'Female friendship can be quiet and deep.',
    concreteExamples: [
      'Wellness retreat together',
      'Yoga retreat',
      'Nature walks and talks',
      'Meditation workshop',
      'Quiet meaningful meals',
      'Journaling/reading together',
      'Supporting each other in peace'
    ],
    avoidMistakes: [
      'Forcing party energy',
      'Only nightlife options',
      'Surface-level social activities',
      'Assuming they want loud/busy'
    ],
    diningGuidance: 'Quiet meaningful meals. Healthy options. Space for conversation.',
    sampleDay: 'Morning practice together. Quiet brunch. Nature walk. Spa. Peaceful dinner.'
  },

  // ═══════════════════════════════════════════════════════════════
  // FAMILY COMBINATIONS - "Not your typical family vacation"
  // ═══════════════════════════════════════════════════════════════

  {
    combination: 'family + adrenaline_architect',
    commonMisunderstanding: 'Adventure with kids is reckless',
    actualNeed: 'AGE-APPROPRIATE adventure. Building adventurous kids.',
    translationPrinciple: 'Adventure families raise adventurous children. Support it.',
    concreteExamples: [
      'Water parks (kid thrills)',
      'Easy hikes with rewards',
      'Snorkeling (kid-safe)',
      'Zip-lining (age-appropriate)',
      'Kayaking calm waters',
      'Bike rides',
      'Junior surf lessons',
      'Adventure parks with kid options'
    ],
    avoidMistakes: [
      'Only passive activities',
      'Assuming kids cannot handle anything',
      'Over-restricting',
      'Adult-level adventure'
    ],
    diningGuidance: 'Casual spots that refuel. Kid-friendly but interesting food.',
    sampleDay: 'Family adventure activity. Casual fun lunch. Rest/pool. Easy evening activity. Early dinner.'
  },

  {
    combination: 'family + culinary_cartographer',
    commonMisunderstanding: 'Kids are picky, forget foodie dreams',
    actualNeed: 'Teaching kids about food. Food adventure as family.',
    translationPrinciple: 'Foodie parents raise adventurous eaters. Support the mission.',
    concreteExamples: [
      'Kid-friendly cooking classes',
      'Market visits (visual, interactive)',
      'Food tours with kid-friendly stops',
      'Pizza-making classes',
      'Ice cream "research"',
      'Teaching kids about local food',
      'Casual but good restaurants',
      'Food as education'
    ],
    avoidMistakes: [
      'Only kids menu restaurants',
      'Skipping food experiences',
      'Assuming kids will not engage',
      'Fine dining with kids (usually)'
    ],
    diningGuidance: 'Casual but quality. Kid-friendly foodie spots. Educational food experiences.',
    sampleDay: 'Market morning. Kid cooking class. Casual good lunch. Rest. Family-friendly foodie dinner.'
  },

  {
    combination: 'family + luxury_luminary',
    commonMisunderstanding: 'Luxury travel with kids is wasteful',
    actualNeed: 'PREMIUM family experience. Kids club. Family suite. Service.',
    translationPrinciple: 'Luxury family travel is a huge market. Serve it.',
    concreteExamples: [
      'Five-star family resorts',
      'Kids clubs (premium childcare)',
      'Family suites',
      'Private family tours',
      'Concierge for family logistics',
      'Child-friendly fine dining',
      'VIP family experiences',
      'Premium family adventures'
    ],
    avoidMistakes: [
      'Budget family options',
      'Assuming luxury is wasted on kids',
      'No premium family options',
      'Treating family as downgrade'
    ],
    diningGuidance: 'Premium family-friendly dining. Nice restaurants with kid service.',
    sampleDay: 'Kids club morning. Parents spa. Family lunch. Pool. Premium family dinner.'
  },

  // ═══════════════════════════════════════════════════════════════
  // BIRTHDAY/CELEBRATION COMBINATIONS - "Different ways to celebrate"
  // ═══════════════════════════════════════════════════════════════

  {
    combination: 'birthday + zen_seeker',
    commonMisunderstanding: 'Birthdays need party energy',
    actualNeed: 'Meaningful birthday. Peaceful celebration. Reflection.',
    translationPrinciple: 'Introverts deserve birthday trips too. Honor quiet celebration.',
    concreteExamples: [
      'Sunrise meditation birthday',
      'Nature birthday (hike to viewpoint)',
      'Solo spa birthday',
      'Quiet special dinner',
      'Meaningful site visit',
      'Journaling/reflection time',
      'One special moment, not party'
    ],
    avoidMistakes: [
      'Forcing party atmosphere',
      'Surprise parties',
      'Group celebrations',
      'Loud venues',
      'Over-the-top fanfare'
    ],
    diningGuidance: 'Quiet special dinner. Meaningful over loud. Quality over fanfare.',
    sampleDay: 'Sunrise practice. Peaceful morning. Meaningful site. Quiet special birthday dinner.'
  },

  {
    combination: 'birthday + gap_year_graduate',
    commonMisunderstanding: 'Birthday = expensive dinner',
    actualNeed: 'Fun birthday experience, not expensive dinner.',
    translationPrinciple: 'Celebration does not require money. Experience over expense.',
    concreteExamples: [
      'Birthday adventure activity',
      'Free birthday experience (beach, hike, sunset)',
      'Budget special meal (best street food, not Michelin)',
      'Hostel birthday party',
      'Birthday at a viewpoint',
      'Creative celebration',
      'Story over status'
    ],
    avoidMistakes: [
      'Expensive dinner pressure',
      'Luxury expectations',
      'Making them feel cheap',
      'Status-focused celebration'
    ],
    diningGuidance: 'Best street food spot. Budget special. Experience over price tag.',
    sampleDay: 'Fun activity. Beach/viewpoint birthday moment. Best budget dinner. Cheap drinks out.'
  },

  {
    combination: 'birthday + healing_journeyer',
    commonMisunderstanding: 'Birthdays should be happy/celebratory',
    actualNeed: 'Gentle birthday. Honoring the year. Self-care celebration.',
    translationPrinciple: 'Some birthdays are about surviving another year. Honor that.',
    concreteExamples: [
      'Peaceful birthday ritual',
      'Nature birthday',
      'Spa self-care',
      'Meaningful solo moment',
      'Reflection time',
      'Gentle celebration',
      'Kind self-acknowledgment'
    ],
    avoidMistakes: [
      'Forced happiness',
      'Over-the-top celebration',
      'Assuming they want attention',
      'Party pressure'
    ],
    diningGuidance: 'Gentle special meal. Self-care dinner. Quiet and kind.',
    sampleDay: 'Gentle morning. Nature time. Quiet reflection. Spa. Peaceful special dinner alone.'
  },

  // ═══════════════════════════════════════════════════════════════
  // RETIREMENT COMBINATIONS - "Still got it"
  // ═══════════════════════════════════════════════════════════════

  {
    combination: 'retirement + adrenaline_architect',
    commonMisunderstanding: 'Retirees should take it easy',
    actualNeed: 'Proving vitality. Adventure within ability. Not ready to slow down.',
    translationPrinciple: 'Age-appropriate adventure is real adventure. Honor it.',
    concreteExamples: [
      'Hiking (appropriate level)',
      'Scuba/snorkeling',
      'Cycling tours (e-bikes if needed)',
      'Safari',
      'Kayaking',
      'Zip-lining (if able)',
      'Golf (competitive element)',
      'Adventure with accessibility considered'
    ],
    avoidMistakes: [
      'Only passive activities',
      'Treating them as fragile',
      'No adventure options',
      'Assuming physical limitation'
    ],
    diningGuidance: 'Quality recovery meals. Comfortable timing. Good restaurants.',
    sampleDay: 'Age-appropriate adventure. Nice lunch. Rest. Light activity. Early quality dinner.'
  },

  {
    combination: 'retirement + gap_year_graduate',
    commonMisunderstanding: 'Retirees have money to spend',
    actualNeed: 'Budget retirement travel. Fixed income. Stretch savings.',
    translationPrinciple: 'Not all retirees are wealthy. Budget travel, dignified.',
    concreteExamples: [
      'Value accommodations',
      'Free activities (parks, walks, beaches)',
      'Senior discounts emphasized',
      'Slow travel (longer, cheaper per day)',
      'Cooking own meals',
      'Off-peak travel',
      'Quality budget options'
    ],
    avoidMistakes: [
      'Luxury assumptions',
      'Expensive defaults',
      'Making them feel cheap',
      'Ignoring budget constraints'
    ],
    diningGuidance: 'Budget quality. Senior specials. Value-focused dining.',
    sampleDay: 'Free morning activity. Budget good lunch. Rest. Affordable quality dinner.'
  },

  // ═══════════════════════════════════════════════════════════════
  // FOODIE COMBINATIONS - "Different ways to eat"
  // ═══════════════════════════════════════════════════════════════

  {
    combination: 'foodie + healing_journeyer',
    commonMisunderstanding: 'Emotional eating / unhealthy',
    actualNeed: 'Comfort food as medicine. Nourishing. Food as healing.',
    translationPrinciple: 'Food can be part of healing. Honor the connection.',
    concreteExamples: [
      'Comfort food done well',
      'Nourishing meals',
      'Gentle food experiences',
      'No pressure dining',
      'Soul-feeding restaurants',
      'Food as self-care',
      'Meaningful eating experiences'
    ],
    avoidMistakes: [
      'Challenging food experiences',
      'High-pressure dining',
      'Extreme cuisine',
      'Performance eating'
    ],
    diningGuidance: 'Comfort food. Nourishing. Soul-feeding. No pressure or challenge.',
    sampleDay: 'Gentle morning. Comforting brunch. Rest. Nourishing dinner. Kind to self.'
  }
];

/**
 * Get oxymoron handler for a specific trip type × archetype combination
 */
export function getOxymoronHandler(tripType: string, archetype: string): OxymoronHandler | null {
  const normalizedTripType = tripType?.toLowerCase().replace(/[\s-]+/g, '_') || '';
  const normalizedArchetype = archetype?.toLowerCase().replace(/[\s-]+/g, '_') || '';
  
  const combinationKey = `${normalizedTripType} + ${normalizedArchetype}`;
  
  return oxymoronHandlers.find(h => 
    h.combination.toLowerCase() === combinationKey.toLowerCase()
  ) || null;
}

/**
 * Build oxymoron-aware prompt section when applicable
 */
export function buildOxymoronPromptSection(tripType: string, archetype: string): string {
  const handler = getOxymoronHandler(tripType, archetype);
  
  if (!handler) return '';
  
  return `
═══════════════════════════════════════════════════════════════════════════
⚠️  SPECIAL COMBINATION DETECTED: ${handler.combination.toUpperCase()}
═══════════════════════════════════════════════════════════════════════════

This combination may SEEM contradictory but represents a REAL traveler type.
Do NOT treat this as an error or edge case.

COMMON MISUNDERSTANDING: ${handler.commonMisunderstanding}

ACTUAL NEED: ${handler.actualNeed}

TRANSLATION PRINCIPLE: ${handler.translationPrinciple}

=== CONCRETE EXAMPLES - What this person actually wants ===
${handler.concreteExamples.map(ex => `✓ ${ex}`).join('\n')}

=== MISTAKES TO AVOID - Common errors with this combination ===
${handler.avoidMistakes.map(m => `✗ ${m}`).join('\n')}

${handler.diningGuidance ? `=== DINING GUIDANCE ===
${handler.diningGuidance}
` : ''}

${handler.sampleDay ? `=== SAMPLE DAY ===
${handler.sampleDay}
` : ''}

COMPLIANCE CHECK:
☐ Does the itinerary honor BOTH the trip type AND the archetype?
☐ Have you avoided the common mistakes listed above?
☐ Would this person recognize this itinerary as THEIR trip?
☐ Is the combination treated as VALID, not as an error to fix?

═══════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Check if a combination is an "oxymoron" that needs special handling
 */
export function isOxymoronCombination(tripType: string, archetype: string): boolean {
  return getOxymoronHandler(tripType, archetype) !== null;
}

/**
 * Build comprehensive solo trip prompt based on archetype
 */
export function buildSoloTripPrompt(archetype: string): string {
  const calibration = soloSocialCalibration[archetype];
  const socialLevel = calibration?.socialLevel || 'medium';
  
  const socialGuidance: Record<string, string> = {
    'high': `
THIS SOLO TRAVELER WANTS TO MEET PEOPLE.

Include:
- Walking tours where they'll meet other travelers
- Hostel social events or pub crawls
- Communal dining experiences
- Group activities
- Bar seating where conversation happens

They're solo by circumstance or choice, but they're SOCIAL.
`,
    'medium': `
THIS SOLO TRAVELER IS OPEN TO EITHER.

Include:
- Activities that work alone OR could turn social
- Walking tours (can engage or just follow)
- Communal tables (might chat, might not)
- Bar seating (option to talk or not)

They enjoy their independence but won't avoid people.
`,
    'low': `
THIS SOLO TRAVELER PREFERS INDEPENDENCE.

Include:
- Self-paced activities (museums, galleries)
- Quiet cafes with good solo seating
- Solo-appropriate dining (not awkward alone)

They're not antisocial, just not seeking interaction.
`,
    'solitude': `
THIS SOLO TRAVELER SEEKS SOLITUDE.

Include:
- Peaceful, quiet activities
- Nature and contemplative spaces
- No group activities unless specifically requested
- Solo dining that doesn't feel exposed

Alone time is the POINT, not a compromise.
`
  };

  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                         TRIP TYPE: SOLO                              ║
╚═══════════════════════════════════════════════════════════════════════╝

This person is traveling ALONE. This is not a couples trip with one person.

═══════════════════════════════════════════════════════════════════════
WHAT SOLO TRAVEL MEANS
═══════════════════════════════════════════════════════════════════════

SOLO TRAVEL IS:
✓ Complete freedom - no compromise
✓ Your exact pace
✓ Independence celebrated
✓ Self-discovery
✓ Flexibility

SOLO TRAVEL IS NOT:
✗ Lonely or sad
✗ Needing to be "fixed" with social activities
✗ A couples trip minus one person
✗ Settling for less

CELEBRATE their solo travel. Don't apologize for it.

═══════════════════════════════════════════════════════════════════════
SOCIAL CALIBRATION: ${socialLevel.toUpperCase()}
═══════════════════════════════════════════════════════════════════════

${socialGuidance[socialLevel] || socialGuidance['medium']}

${calibration?.include ? `
INCLUDE FOR THIS SOLO TRAVELER:
${calibration.include.map(i => `• ${i}`).join('\n')}
` : ''}

${calibration?.avoid ? `
AVOID FOR THIS SOLO TRAVELER:
${calibration.avoid.map(a => `• ${a}`).join('\n')}
` : ''}

═══════════════════════════════════════════════════════════════════════
SOLO DINING REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

EVERY meal must be solo-friendly. Suggest:

✓ Counter seating (ramen, sushi bars, tapas counters)
✓ Communal tables (might meet people, no pressure)
✓ Casual spots (trattorias, bistros - less formal)
✓ Food markets and street food (no seating pressure)
✓ Cafes with good solo atmosphere
✓ Wine bars with bar seating
✓ Lunch spots (more acceptable solo dining)

NEVER suggest:
✗ Romantic restaurants with 2-top tables
✗ Fine dining that feels awkward alone
✗ Places where everyone is clearly on dates
✗ "Perfect for couples" venues

When describing restaurants, mention:
"Counter seating perfect for solo diners"
"Casual enough to enjoy alone with a book"
"Communal tables where you might meet other travelers"

═══════════════════════════════════════════════════════════════════════
SOLO-FRIENDLY ACTIVITIES
═══════════════════════════════════════════════════════════════════════

GREAT SOLO:
• Museums (your pace, no one rushing you)
• Walking tours (can be social or just follow along)
• Food tours (structured social, easy for solo)
• Markets (wander alone, graze solo)
• Cafes (read, write, watch the world)
• Parks and gardens
• Self-guided neighborhood walks
• Yoga/fitness classes (group but independent)
• Counter-seating restaurants
• Wine bars

AWKWARD SOLO:
• Couples cooking classes
• Romantic boat rides
• Couples spa packages
• Activities requiring pairs
• Fine dining at romantic tables
• Tandem anything

═══════════════════════════════════════════════════════════════════════
SAFETY CONSIDERATIONS
═══════════════════════════════════════════════════════════════════════

For evening activities:
- Recommend well-lit, populated areas
- Note safe neighborhoods for walking alone at night
- Suggest earlier timing if area is less safe late
- Mention transport options (not walking alone through empty areas)

═══════════════════════════════════════════════════════════════════════
FREEDOM EMPHASIS
═══════════════════════════════════════════════════════════════════════

The POINT of solo travel is freedom. Include:

- Unstructured time blocks ("do whatever you want")
- Permission language ("if you feel like it", "or skip and wander")
- Flexibility ("stay longer if you love it")
- No obligation ("no reservations needed")

Phrases to use:
"Take as long as you want"
"No one's waiting"
"Your pace exactly"
"Change plans if you feel like it"
"Sleep in if you want"

═══════════════════════════════════════════════════════════════════════
`;
}

/**
 * Build comprehensive honeymoon prompt with REST emphasis
 */
export function buildHoneymoonPrompt(): string {
  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                         TRIP TYPE: HONEYMOON                         ║
╚═══════════════════════════════════════════════════════════════════════╝

This couple JUST GOT MARRIED. They are:
- EXHAUSTED from wedding planning (months/years of stress)
- On their most special trip ever (high expectations)
- Wanting romance but also REST
- Probably sleep-deprived from the wedding weekend

THIS IS NOT just "romantic vacation." It's POST-WEDDING recovery + romance.

═══════════════════════════════════════════════════════════════════════
HONEYMOON REST REQUIREMENTS (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════════════

They just survived a wedding. They're running on fumes.

MUST INCLUDE:
✓ Late start times (10am+) - they need sleep
✓ Afternoon rest blocks (pool, nap, spa)
✓ NO packed schedules - they're exhausted
✓ Buffer time everywhere
✓ At least one "do nothing" day

PACING: Subtract 2 from normal pace score.
Even a Milestone Voyager honeymooner needs rest.

NEVER:
✗ 7am departures
✗ Back-to-back activities
✗ "Efficient" itineraries
✗ More than 2-3 activities per day

═══════════════════════════════════════════════════════════════════════
HONEYMOON ROMANCE REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

This should FEEL like a honeymoon, not a regular couples trip.

MUST INCLUDE:
✓ At least 2 special romantic dinners (not every night - that's exhausting)
✓ At least 1 sunset/sunrise moment together
✓ Private/intimate experiences over group tours
✓ Couples activities (massage, cooking class, private tour)
✓ Language that acknowledges they just got married

PHRASES TO USE:
"Perfect for newlyweds"
"Celebrate your new marriage"
"Start your married life with..."
"Honeymoon-worthy"

AVOID:
✗ Group tours with strangers
✗ Hostel recommendations
✗ Budget-focused language
✗ Anything that feels generic

═══════════════════════════════════════════════════════════════════════
HONEYMOON UPGRADE PRINCIPLE
═══════════════════════════════════════════════════════════════════════

Within their budget tier, lean toward the nicer option.

Budget honeymoon: Best-value romantic spots, not cheapest
Moderate honeymoon: Splurge on 1-2 special experiences
Luxury honeymoon: Full premium treatment

This trip should feel ELEVATED compared to their normal travel.

═══════════════════════════════════════════════════════════════════════
COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

☐ Do start times allow sleeping in? (10am+ most days)
☐ Is there rest time daily? (pool, spa, nap)
☐ Are there at least 2 romantic dinner highlights?
☐ Is there at least 1 romantic moment (sunset, etc.)?
☐ Is pacing relaxed (2-3 activities max per day)?
☐ Does it feel SPECIAL, not generic?
☐ Would exhausted newlyweds actually enjoy this?
☐ Are activities intimate, not group-focused?

⚠️ If this looks like a packed sightseeing trip = REGENERATE
`;
}

/**
 * Build comprehensive family trip prompt with kid logistics
 */
export function buildFamilyPrompt(): string {
  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                         TRIP TYPE: FAMILY                            ║
╚═══════════════════════════════════════════════════════════════════════╝

This trip includes CHILDREN. Everything must work for families.

KIDS ARE NOT SMALL ADULTS. They:
- Get tired (meltdowns happen)
- Need frequent breaks (bathrooms, snacks, rest)
- Have shorter attention spans
- Need to EAT on schedule (hangry is real)
- Can't walk for 6 hours straight
- Need engaging activities (not just "looking at old stuff")

═══════════════════════════════════════════════════════════════════════
FAMILY TIMING REQUIREMENTS (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════════════

MEAL TIMES (kids can't wait):
- Breakfast: 7:30-8:30
- Lunch: 12:00-13:00 (NOT 2pm - kids will melt down)
- Dinner: 17:30-18:30 (NOT 8pm - kids need to sleep)

REST TIME (non-negotiable):
- 13:00-15:00: Back to hotel OR low-key activity
- This is for naps, pool time, or just decompression
- NEVER schedule a museum at 2pm

DAY END:
- Evening activities must end by 19:00-20:00
- Kids need wind-down time before bed
- No 10pm dinners

MORNING START:
- Not too early (families are slow to mobilize)
- Not too late (waste of day)
- 9:00-10:00 for first activity is ideal

═══════════════════════════════════════════════════════════════════════
FAMILY ACTIVITY REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

GOOD FOR KIDS:
✓ Interactive (touch, do, not just look)
✓ Short duration (60-90 min max per activity)
✓ Bathroom accessible
✓ Snack breaks built in
✓ Some movement/running around
✓ Engaging for their age
✓ Mix of education and fun

EXAMPLES:
- Zoo/Aquarium (interactive, can leave when tired)
- Parks with playgrounds (burn energy)
- Easy hikes (nature, movement)
- Kid-friendly museums (science, interactive)
- Beach time (entertainment + rest)
- Cooking classes for families (hands-on)
- Boat rides (contained, novel)

AVOID:
✗ Long museum visits (hours of looking)
✗ Formal tours where kids must be quiet
✗ Fine dining (long waits, quiet expectations)
✗ Long walking days (6+ hours)
✗ Adult-focused activities
✗ Late-night anything
✗ Very early morning departures

═══════════════════════════════════════════════════════════════════════
FAMILY DINING REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

RESTAURANTS MUST BE:
✓ Kid-friendly (tolerant of noise/mess)
✓ Flexible on timing (not "seating at 8pm only")
✓ Have quick options (kids can't wait 45 min for food)
✓ Casual atmosphere
✓ High chairs/kid seating available

GOOD OPTIONS:
- Casual trattorias
- Pizza places
- Outdoor seating (kids can move)
- Fast-casual spots
- Food markets (everyone picks their own)
- Early dinner reservations

NEVER:
✗ Michelin restaurants (unless explicitly kid-friendly)
✗ Romantic/intimate venues
✗ Places with long waits
✗ Very late dinner reservations
✗ Tasting menus (too long)

═══════════════════════════════════════════════════════════════════════
FAMILY PACING
═══════════════════════════════════════════════════════════════════════

MAX 2-3 activities per day (not 5-6)

IDEAL FAMILY DAY:
- Morning: 1 activity (museum, zoo, etc.)
- Lunch: Kid-friendly spot, not rushed
- Afternoon: REST (pool, nap, playground) 13:00-15:00
- Late afternoon: 1 light activity (park, easy walk)
- Early dinner: Casual spot by 18:00
- Evening: Back to hotel, wind down

NEVER:
- Museum → Museum → Museum
- 5 activities in one day
- Activities during rest time (13:00-15:00)
- Anything after 20:00

═══════════════════════════════════════════════════════════════════════
COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

☐ Are meals at kid-appropriate times (lunch by 13:00, dinner by 18:30)?
☐ Is there rest time 13:00-15:00?
☐ Do activities end by 19:00-20:00?
☐ Are restaurants kid-friendly (not fine dining)?
☐ Are activities interactive (not just looking)?
☐ Max 2-3 activities per day?
☐ Are there bathroom/snack considerations?
☐ Would a parent look at this and think "this would actually work"?

⚠️ FAILURE: If a parent would say "my kid would melt down," fix it.
`;
}

/**
 * Build comprehensive babymoon prompt with pregnancy specifics
 */
export function buildBabymoonPrompt(): string {
  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                         TRIP TYPE: BABYMOON                          ║
╚═══════════════════════════════════════════════════════════════════════╝

This is a couple's LAST TRIP BEFORE BABY. The pregnant person is:
- Possibly exhausted (growing a human is tiring)
- Possibly nauseous (especially first trimester)
- Limited in activities (no adventure, no extreme heat)
- May have food restrictions
- Needs more rest than normal
- Needs comfortable everything

This is NOT a regular romantic trip with "prenatal massage added."
The entire trip must accommodate pregnancy.

═══════════════════════════════════════════════════════════════════════
BABYMOON ACTIVITY REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

SAFE FOR PREGNANCY:
✓ Gentle walking (not hiking)
✓ Swimming (excellent for pregnancy)
✓ Prenatal spa treatments (certified safe)
✓ Easy sightseeing (with sitting options)
✓ Relaxation (pool, beach, garden)
✓ Gentle yoga (prenatal)
✓ Scenic drives (if no motion sickness)

ABSOLUTELY NOT:
✗ Adventure activities (zip-line, etc.)
✗ Hot tubs/saunas (dangerous in pregnancy)
✗ Strenuous hiking
✗ Extreme heat exposure
✗ High altitude (check with doctor)
✗ Scuba diving
✗ Horseback riding
✗ Anything with fall risk
✗ Long periods without bathrooms
✗ Very long walks

═══════════════════════════════════════════════════════════════════════
BABYMOON DINING REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

PREGNANCY FOOD CONSIDERATIONS:
- No raw fish (sushi) unless cooked options available
- No unpasteurized cheese
- No undercooked meat
- No high-mercury fish
- Caffeine limits (note decaf options)
- No alcohol focus (partner can drink, don't center activities on it)

WHEN RECOMMENDING RESTAURANTS:
✓ Note pregnancy-safe options
✓ Include variety (cravings change)
✓ Don't center on wine/cocktails
✓ Note if they accommodate dietary restrictions

PHRASES TO USE:
"Plenty of pregnancy-safe options"
"Cooked sushi available"
"Can accommodate dietary needs"

═══════════════════════════════════════════════════════════════════════
BABYMOON PACING (SLOWEST TRIP TYPE)
═══════════════════════════════════════════════════════════════════════

REQUIREMENTS:
✓ Very late starts (10am+) - she's tired
✓ Max 1-2 activities per day
✓ Long rest blocks (afternoon nap/pool)
✓ Early dinners (pregnancy exhaustion hits at night)
✓ Short walking distances
✓ Frequent bathroom access
✓ Sitting/rest options throughout

PACING ADJUSTMENT: Subtract 3 from normal pace.
Even an Adrenaline Architect needs to rest on a babymoon.

IDEAL BABYMOON DAY:
- 10:00: Slow breakfast
- 11:00: One gentle activity (garden, easy museum)
- 13:00: Lunch
- 14:00-17:00: REST (pool, nap, spa)
- 18:00: Early dinner
- 20:00: Back to hotel

NEVER:
✗ Full day excursions
✗ Packed schedules
✗ Strenuous anything
✗ Late nights

═══════════════════════════════════════════════════════════════════════
BABYMOON COMFORT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

CONSIDERATIONS:
- Pool access (swimming feels amazing pregnant)
- Shade available (overheating risk)
- Seating everywhere
- Bathroom frequency
- Air conditioning (pregnant = running hot)

═══════════════════════════════════════════════════════════════════════
COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

☐ Are all activities pregnancy-safe? (no adventure, no heat, no risk)
☐ Is pacing very slow? (max 1-2 activities/day)
☐ Are there long rest blocks? (afternoon rest daily)
☐ Are dining options pregnancy-friendly? (no raw fish focus)
☐ Is there pool/water access? (swimming is best for pregnancy)
☐ Are walking distances short?
☐ Is bathroom access considered?
☐ Would an exhausted pregnant person actually enjoy this?

⚠️ FAILURE: If it would be uncomfortable or risky for a pregnant person, fix it.
`;
}

/**
 * Build comprehensive birthday prompt with personalization
 */
export function buildBirthdayPrompt(archetype: string, celebrationDay?: number, totalDays?: number): string {
  const celebrationDayText = celebrationDay 
    ? `\n⭐ THE ACTUAL BIRTHDAY IS DAY ${celebrationDay}. ⭐\nONLY Day ${celebrationDay} should have birthday activities, dinner, and celebration moments.\nDays 1-${celebrationDay - 1} and ${celebrationDay + 1}-${totalDays || celebrationDay} should be NORMAL days with no birthday theming.\n`
    : '';
  
  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                        TRIP TYPE: BIRTHDAY                           ║
╚═══════════════════════════════════════════════════════════════════════╝
${celebrationDayText}
Someone is CELEBRATING A BIRTHDAY. The trip should honor THEM.

KEY INSIGHT: Birthday trip ≠ "birthday activities everywhere."
It means: the trip is designed around what THEY want.

⚠️ CRITICAL: ONLY ONE DAY gets birthday activities.${celebrationDay ? ` That day is Day ${celebrationDay}.` : ''}
All other days should be NORMAL itinerary days with NO birthday theming.

A birthday for a Slow Traveler ≠ party party party.
A birthday for an Introvert ≠ group celebration.

The birthday person's archetype (${archetype}) determines HOW to celebrate.

═══════════════════════════════════════════════════════════════════════
BIRTHDAY CELEBRATION REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

MUST INCLUDE:
✓ ONE special "birthday dinner" (doesn't have to be fancy, has to be THEM)
✓ ONE "birthday moment" or surprise
✓ Activities that feel like gifts to them (based on archetype)

MODERATION:
- Not EVERY meal is "birthday dinner"
- Not EVERY activity has "birthday" in the name
- Celebrate without overwhelming

PHRASES:
- "Birthday [activity]" - use once, not repeatedly
- "Celebrate with" - use sparingly
- "Special" - for the actual special thing

AVOID:
✗ Forced birthday activities they wouldn't enjoy
✗ Generic "birthday = fancy dinner" when they're Budget/Casual
✗ Labeling everything "birthday"

═══════════════════════════════════════════════════════════════════════
BIRTHDAY PERSONALIZATION
═══════════════════════════════════════════════════════════════════════

The birthday celebration should match their ARCHETYPE.

Examples:
- Slow Traveler birthday: Long leisurely special lunch, no rush
- Adrenaline Architect birthday: That adventure activity they've always wanted
- Culinary Cartographer birthday: THE restaurant they've been dying to try
- Wildcard birthday: Discovery of something unexpected
- Social Butterfly birthday: Celebration with people, energy
- Zen Seeker birthday: Meaningful, peaceful, possibly solo moment
- Budget Backpacker birthday: Fun experience, not expensive dinner

ASK: What would THIS person want for their birthday?
NOT: What does a generic "birthday" look like?

═══════════════════════════════════════════════════════════════════════
BIRTHDAY VS REGULAR TRIP
═══════════════════════════════════════════════════════════════════════

Most of the trip = normal great trip for their archetype
Birthday elements = 1-2 special moments that mark the occasion

Don't make every day "birthday day."
The birthday dinner IS the birthday dinner.
The rest is just a great trip.

═══════════════════════════════════════════════════════════════════════
COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

☐ Is there ONE special birthday dinner/meal (not every meal)?
☐ Is there ONE birthday moment/surprise?
☐ Does the celebration style match their archetype?
☐ Is the rest of the trip normal (not birthday-overload)?
☐ Would the birthday person feel celebrated without overwhelmed?
☐ Does it feel personalized to THEM, not generic "birthday"?

⚠️ FAILURE: If it's generic "birthday activities" that don't match who they are, fix it.
`;
}

/**
 * Build comprehensive anniversary prompt
 */
export function buildAnniversaryPrompt(): string {
  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                       TRIP TYPE: ANNIVERSARY                         ║
╚═══════════════════════════════════════════════════════════════════════╝

This couple is celebrating a RELATIONSHIP MILESTONE.
The trip should honor their history together and create new memories.

Unlike honeymoon (which is post-wedding exhaustion + romance),
anniversary is about:
- Celebrating how far they've come
- Quality time together
- Romance without exhaustion
- Making new memories as a couple

═══════════════════════════════════════════════════════════════════════
ANNIVERSARY ROMANCE REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

MUST INCLUDE:
✓ At least 1 special romantic dinner (THE anniversary meal)
✓ At least 1 romantic moment (sunset, view, special spot)
✓ Couples-focused activities (not group tours)
✓ Intimate atmosphere over crowds

PHRASES TO USE:
"Perfect for celebrating"
"Romantic setting"
"Intimate atmosphere"
"Couples [activity]"

DINING FOR ANNIVERSARY:
- THE dinner should feel special
- Request "anniversary" to restaurant
- Consider: view, atmosphere, significance
- Doesn't have to be most expensive, but should be meaningful

═══════════════════════════════════════════════════════════════════════
ANNIVERSARY BALANCE
═══════════════════════════════════════════════════════════════════════

Unlike honeymoon, anniversary travelers aren't exhausted.
They can do more, but romance should thread through.

GOOD BALANCE:
- Morning: Activity together (museum, walk, etc.)
- Afternoon: Leisure time, maybe spa
- Evening: Romantic dinner

Romance doesn't mean "only candles and roses."
Anniversary for an Adrenaline Architect couple = adventure TOGETHER.
Anniversary for Culinary Cartographers = food tour TOGETHER.

The key is: TOGETHER, celebrating.

═══════════════════════════════════════════════════════════════════════
ACKNOWLEDGE THE MILESTONE
═══════════════════════════════════════════════════════════════════════

The itinerary should feel like it knows this is an anniversary.

INCLUDE:
✓ One "toast-worthy" moment
✓ Activities framed as "celebrating X years"
✓ At least one special experience

DON'T:
✗ Make it generic "couples trip"
✗ Forget to mark the occasion
✗ Treat it like friends traveling together

═══════════════════════════════════════════════════════════════════════
COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

☐ Is there a special anniversary dinner?
☐ Is there at least one romantic moment/setting?
☐ Are activities couples-focused (not group)?
☐ Does itinerary acknowledge this is a celebration?
☐ Would a couple say "this feels like an anniversary trip"?
☐ Is romance present without being cheesy/forced?

⚠️ FAILURE: If this could be any random couples trip, add anniversary elements.
`;
}

/**
 * Build comprehensive guys trip prompt
 */
export function buildGuysTripPrompt(): string {
  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                        TRIP TYPE: GUYS TRIP                          ║
╚═══════════════════════════════════════════════════════════════════════╝

A group of male friends traveling together.
The vibe is: bonding, fun, shared experiences, maybe some adventure.

NOT: A solo trip that happens to have multiple people.
The GROUP NATURE should be visible throughout.

═══════════════════════════════════════════════════════════════════════
GUYS TRIP ACTIVITY REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

GOOD FOR GUYS GROUPS:
✓ Sports (watching or playing)
✓ Adventure activities (group adrenaline)
✓ Tours that work for groups (beer tour, food tour)
✓ Active experiences (hiking, water sports)
✓ Competitive elements (golf, go-karts, etc.)
✓ Shared experiences that create stories

EXAMPLES BY INTEREST:
- Sports fans: Local sports match, sports bar
- Food guys: Brewery tour, BBQ pilgrimage
- Adventure guys: Group activity (rafting, hiking)
- Chill guys: Golf, beach, pool, cards

DINING FOR GUYS:
- Group-friendly tables
- Shareable food (not tasting menus)
- Casual atmosphere
- Good beer/drinks selection
- Not romantic/intimate venues

═══════════════════════════════════════════════════════════════════════
GUYS TRIP EVENING
═══════════════════════════════════════════════════════════════════════

At least ONE evening should have bar/pub/nightlife option.

OPTIONS:
- Sports bar (especially if game on)
- Pub crawl / bar hopping
- Live music venue
- Casino (where appropriate)
- Rooftop bar with views
- Local dive bar (authentic)

NOTE: Not all guys trips are party trips.
Calibrate to archetype:
- Zen Seeker guys = might skip nightlife
- Boundless Explorer guys = early dinner, one nice bar
- Horizon Chaser guys = maximum nightlife

But generally, at least ONE evening option should be there.

═══════════════════════════════════════════════════════════════════════
GUYS TRIP BONDING
═══════════════════════════════════════════════════════════════════════

The trip should include activities that build group memories.

AT LEAST ONE:
- Shared adventure/challenge
- Group meal with stories
- Something they'll talk about later

"Remember when we..." is the goal.

═══════════════════════════════════════════════════════════════════════
GUYS TRIP PACING
═══════════════════════════════════════════════════════════════════════

Groups are slower than individuals.
Add buffer time everywhere.

CONSIDERATIONS:
- Morning mobilization is slow (late starts)
- Decisions take longer (consensus needed)
- Someone always needs something
- +15-20min buffer between activities
- Don't over-schedule (group energy varies)

═══════════════════════════════════════════════════════════════════════
AVOID FOR GUYS TRIP
═══════════════════════════════════════════════════════════════════════

✗ Romantic restaurants
✗ Couples activities
✗ Spa (unless golf-trip vibe)
✗ Intimate venues
✗ Solo-focused experiences
✗ Activities that split the group

═══════════════════════════════════════════════════════════════════════
COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

☐ Is there at least ONE group bonding activity?
☐ Is there at least ONE evening/bar option?
☐ Are restaurants group-friendly (not romantic)?
☐ Is it OBVIOUS this is a group trip (not solo)?
☐ Does pacing account for group dynamics?
☐ Would a group of guys look at this and get excited?

⚠️ FAILURE: If this looks like a solo trip or couples trip, fix it.
`;
}

/**
 * Build comprehensive girls trip prompt
 */
export function buildGirlsTripPrompt(): string {
  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                        TRIP TYPE: GIRLS TRIP                         ║
╚═══════════════════════════════════════════════════════════════════════╝

A group of female friends traveling together.
The vibe is: bonding, fun, shared experiences, celebration of friendship.

The GROUP NATURE and FEMALE FRIENDSHIP should be visible throughout.

═══════════════════════════════════════════════════════════════════════
GIRLS TRIP ACTIVITY REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

CLASSIC GIRLS TRIP ACTIVITIES:
✓ Wine/cocktail tasting
✓ Spa day
✓ Cooking class
✓ Shopping (with group energy)
✓ Beach/pool day
✓ Brunch (mandatory!)
✓ Photo-worthy experiences
✓ Group classes (yoga, dance, etc.)

DINING FOR GIRLS GROUPS:
- Shareable food (tapas, mezze, family style)
- Cute/aesthetic atmosphere
- Good cocktail menu
- Brunch spots (essential)
- Rooftop/view options
- Instagram-worthy presentation

NOT:
✗ Dark, dingy pubs
✗ Super casual (unless that's their vibe)
✗ Romantic couples spots
✗ Sports-focused venues

═══════════════════════════════════════════════════════════════════════
GIRLS TRIP PHOTO MOMENTS
═══════════════════════════════════════════════════════════════════════

Photo-worthy experiences are important for many girls trips.

INCLUDE AT LEAST 1-2:
- Scenic viewpoint
- Aesthetic cafe/restaurant
- Pretty street/area
- Landmark photo spot
- Sunset/sunrise spot

Note when something is "great for photos."

═══════════════════════════════════════════════════════════════════════
GIRLS TRIP PAMPERING
═══════════════════════════════════════════════════════════════════════

Many (not all) girls trips include pampering.

OPTIONS:
- Spa day/half day
- Mani/pedi outing
- Pool/beach relaxation
- Wine tasting
- Afternoon tea

NOTE: Calibrate to archetype.
- Adrenaline Architect girls = adventure first, maybe spa after
- Wellness girls = spa heavy
- Budget girls = skip spa, DIY pampering

═══════════════════════════════════════════════════════════════════════
GIRLS TRIP BONDING
═══════════════════════════════════════════════════════════════════════

Include activities that foster conversation and connection.

GOOD FOR BONDING:
- Long meals (talking time)
- Wine tasting (relaxed, conversational)
- Pool/beach lounging (chatting)
- Walking together (side-by-side talk)
- Cooking class (doing together)

Activities should allow TALKING, not just doing.

═══════════════════════════════════════════════════════════════════════
COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

☐ Is there at least ONE photo-worthy experience?
☐ Is there brunch? (Often expected)
☐ Are restaurants cute/shareable food?
☐ Is there at least ONE evening out option?
☐ Is it OBVIOUS this is a girls trip (not solo or couples)?
☐ Would a group of women look at this and get excited?

⚠️ FAILURE: If this looks like a solo trip or couples trip, fix it.
`;
}

/**
 * Build comprehensive adventure trip prompt
 */
export function buildAdventurePrompt(): string {
  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                      TRIP TYPE: ADVENTURE TRIP                       ║
╚═══════════════════════════════════════════════════════════════════════╝

Adventure is the PURPOSE of this trip.
The itinerary should center on adventure activities, not add them as one-offs.

This effectively makes them an Adrenaline Architect for this trip,
regardless of their base archetype.

═══════════════════════════════════════════════════════════════════════
ADVENTURE TRIP ACTIVITY REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

ADVENTURE MUST DOMINATE:
- Adventure activity every day (or every other day with recovery)
- Trip should be 60%+ adventure activities
- Non-adventure activities are supporting (meals, recovery)

TYPES OF ADVENTURE:
- Water: Surfing, diving, kayaking, rafting, kiteboarding
- Mountain: Hiking, climbing, mountaineering, via ferrata
- Air: Skydiving, paragliding, zip-lining, bungee
- Land: Mountain biking, ATV, motorcycling, canyoning
- Snow: Skiing, snowboarding, ice climbing

INTENSITY CALIBRATION:
Match to their actual ability level.
"Adventure" for a beginner ≠ "Adventure" for an expert.

Include:
✓ At least ONE marquee adventure (the big one)
✓ Supporting adventures (variety)
✓ Progression if multi-day (build skills)

═══════════════════════════════════════════════════════════════════════
ADVENTURE TRIP RECOVERY
═══════════════════════════════════════════════════════════════════════

Adventure is physically demanding. Build in recovery.

REQUIREMENTS:
- After major activity: recovery block (pool, massage, rest)
- Every 2-3 intense days: one lighter day
- Adequate sleep time (adventure is tiring)
- Protein/fuel-focused dining (not just pretty food)

SAMPLE RHYTHM:
Day 1: Arrive, light activity
Day 2: BIG adventure
Day 3: Medium adventure + recovery
Day 4: BIG adventure
Day 5: Light adventure or rest day
Day 6: Depart

═══════════════════════════════════════════════════════════════════════
ADVENTURE LOGISTICS
═══════════════════════════════════════════════════════════════════════

TIMING:
- Many adventures are morning activities (weather, energy)
- Allow time for gear, briefing, transport
- Don't schedule tight connections after adventures

CONSIDERATIONS:
- Note what's provided vs what to bring
- Note physical requirements
- Note fitness prerequisites
- Weather dependencies

═══════════════════════════════════════════════════════════════════════
ADVENTURE DINING
═══════════════════════════════════════════════════════════════════════

Focus on FUEL, not fancy.

GOOD:
- Hearty breakfast (energy for activity)
- Quick lunch OR packed lunch
- Recovery dinner (protein, carbs)
- Hydration-focused
- Casual atmosphere (tired people)

NOT:
- Tasting menus (too long, too light)
- Fancy dress code (no energy)
- Very late dinners (exhausted)

═══════════════════════════════════════════════════════════════════════
COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

☐ Is adventure 60%+ of activities?
☐ Is there at least ONE marquee adventure?
☐ Is there recovery time built in?
☐ Is dining fuel-focused (not foodie-focused)?
☐ Would an adventure lover be excited by this?
☐ Is it obvious this is an ADVENTURE trip, not tourism with one activity?

⚠️ FAILURE: If adventure isn't dominant, fix it.
`;
}

/**
 * Build comprehensive foodie trip prompt
 */
export function buildFoodiePrompt(): string {
  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                     TRIP TYPE: FOOD & CULINARY                       ║
╚═══════════════════════════════════════════════════════════════════════╝

Food is the PURPOSE of this trip.
Meals aren't interruptions to sightseeing - they ARE the main events.

This effectively makes them a Culinary Cartographer for this trip.

═══════════════════════════════════════════════════════════════════════
FOODIE TRIP STRUCTURE
═══════════════════════════════════════════════════════════════════════

Food should be 60%+ of the experience.

TYPICAL FOODIE DAY:
- 09:00: Market visit or food neighborhood walk
- 12:00-14:00: LUNCH - main event, researched spot
- 15:00: Food-related activity (cooking class, producer visit, food tour)
- 16:30: Light snack / rest
- 19:30-22:00: DINNER - highlight meal

Every meal is intentional, not "grab something quick."

═══════════════════════════════════════════════════════════════════════
FOODIE EXPERIENCES (REQUIRED)
═══════════════════════════════════════════════════════════════════════

MUST INCLUDE (over a trip):
✓ At least ONE market visit
✓ At least ONE cooking class or food-making experience
✓ At least ONE "signature restaurant" (THE meal of the trip)
✓ Multiple discovery meals (trying local specialties)
✓ Food shopping/sourcing experience

EXAMPLES:
- Markets: Central market, farmers market, specialty food market
- Classes: Cooking class, wine/coffee/chocolate making
- Discovery: Food tour, local specialties hunt, neighborhood grazing
- Signature: THE restaurant, chef's table, special dining experience
- Shopping: Deli/cheese shop, spice market, local producers

═══════════════════════════════════════════════════════════════════════
FOODIE DINING REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

EVERY meal matters. No "just grab something."

LUNCH:
- Not quick/casual unless intentionally so
- Often 1-2 hour affair
- Researched, intentional

DINNER:
- Main event of evening
- Researched, often reserved
- Allow 2+ hours

VARIETY:
- Mix of fancy and casual
- Mix of cuisines/neighborhoods
- Street food AND restaurants
- Different experiences (counter, table, market, etc.)

RESERVATIONS:
- Book key meals in advance
- Note which need reservations
- Note which are walk-in

═══════════════════════════════════════════════════════════════════════
FOODIE PACING
═══════════════════════════════════════════════════════════════════════

Food trips are SLOW. You can't rush digestion.

REQUIREMENTS:
- 2-3 hours for lunch
- 2-3 hours for dinner
- Rest time between meals (digestion)
- Not too many activities between meals
- Room for spontaneous food discoveries

DANGER: Over-scheduling non-food activities.
Leave room to:
- Linger at markets
- Get second helpings
- Discover a spot and stay
- Food coma recovery

═══════════════════════════════════════════════════════════════════════
COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

☐ Is food 60%+ of the experience?
☐ Is there a market visit?
☐ Is there a cooking class or food activity?
☐ Is there a signature dinner (THE meal)?
☐ Are meals given proper time (2+ hours for sit-down)?
☐ Is there variety (street food to fancy, multiple cuisines)?
☐ Would a food lover be excited by every meal?
☐ Is it obvious this is a FOOD trip, not tourism with good restaurants?

⚠️ FAILURE: If food isn't dominant, fix it.
`;
}

/**
 * Build comprehensive wellness retreat prompt
 */
export function buildWellnessPrompt(): string {
  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                     TRIP TYPE: WELLNESS RETREAT                      ║
╚═══════════════════════════════════════════════════════════════════════╝

Wellness is the PURPOSE of this trip.
This is not "vacation with spa added." Wellness IS the agenda.

This effectively makes them a Wellness Devotee or Zen Seeker for this trip.

═══════════════════════════════════════════════════════════════════════
WELLNESS RETREAT STRUCTURE
═══════════════════════════════════════════════════════════════════════

Wellness should dominate every day.

TYPICAL WELLNESS DAY:
- 07:00: Morning practice (yoga, meditation, walk)
- 08:30: Healthy breakfast
- 10:00: Wellness activity or treatment
- 12:00: Healthy lunch
- 13:00-15:00: Rest/integration time
- 15:00: Afternoon treatment or activity
- 18:00: Evening practice or reflection
- 19:00: Healthy dinner
- 21:00: Wind down, sleep

WELLNESS ELEMENTS:
- Movement: yoga, pilates, tai chi, gentle hiking
- Stillness: meditation, breathwork, journaling
- Treatment: massage, spa, healing treatments
- Nature: time outdoors, grounding, fresh air
- Rest: sleep, naps, doing nothing

═══════════════════════════════════════════════════════════════════════
WELLNESS ACTIVITIES (REQUIRED)
═══════════════════════════════════════════════════════════════════════

INCLUDE DAILY:
✓ Morning practice (yoga, meditation, walk)
✓ At least one treatment or wellness activity
✓ Nature/outdoor time
✓ Rest/integration time

EXAMPLES:
- Yoga (various styles, adjust to level)
- Meditation (guided, silent, walking)
- Spa treatments (massage, facial, body work)
- Breathwork
- Sound healing
- Forest bathing
- Gentle hiking
- Swimming/water therapy
- Journaling/reflection time

═══════════════════════════════════════════════════════════════════════
WELLNESS DINING
═══════════════════════════════════════════════════════════════════════

Food should support wellness goals.

REQUIREMENTS:
- Healthy, whole foods focus
- Plant-forward options
- Organic/local where possible
- Mindful eating atmosphere
- No rushed meals

INCLUDE:
- Clear/fresh breakfasts
- Light, nourishing lunches
- Early, balanced dinners
- Hydration emphasis
- Juice/smoothie options

NOT:
- Heavy, rich food
- Late dinners
- Alcohol-focused
- Processed food
- Rushed eating

═══════════════════════════════════════════════════════════════════════
WELLNESS PACING (VERY SLOW)
═══════════════════════════════════════════════════════════════════════

Wellness is SLOW. This is the slowest trip type besides babymoon.

REQUIREMENTS:
- No rushing anywhere
- Lots of white space
- Integration time after treatments
- Early bedtimes (sleep is wellness)
- Late, gentle mornings OK

AVOID:
- Packed schedules
- Back-to-back activities
- Rushing between things
- Late nights
- Early flights

═══════════════════════════════════════════════════════════════════════
WELLNESS ENVIRONMENT
═══════════════════════════════════════════════════════════════════════

Setting matters for wellness.

PRIORITIZE:
- Quiet accommodations
- Nature access
- Peaceful atmosphere
- Away from crowds/noise
- Digital detox friendly

═══════════════════════════════════════════════════════════════════════
COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

☐ Is there morning wellness practice daily?
☐ Is there at least one treatment per day?
☐ Is dining health-focused (not indulgent)?
☐ Is pacing very slow with integration time?
☐ Are activities wellness-focused (not sightseeing)?
☐ Would someone feel restored, not tired, after this?
☐ Is it obvious this is a WELLNESS trip, not vacation with spa?

⚠️ FAILURE: If wellness isn't dominant, fix it.
`;
}

export const tripTypeModifiers: Record<string, TripTypeModifier> = {
  // ============ CELEBRATIONS ============

  birthday: {
    name: "Birthday Trip",
    description: "Celebrating a birthday",
    mustInclude: [
      "ONE special celebration dinner (not every dinner)",
      "ONE surprise or special moment",
      "Activity the birthday person specifically loves (based on archetype)"
    ],
    atmosphere: "Celebratory but not over-the-top. Focus on what THEY want, not generic 'birthday' activities.",
    promptAddition: '', // Built dynamically with buildBirthdayPrompt()
    frequency: {
      specialDinner: 1,
      celebrationMoment: 1,
      mentionInActivities: 0
    },
    pacingModifier: 0
  },

  anniversary: {
    name: "Anniversary Trip",
    description: "Celebrating a relationship milestone",
    mustInclude: [
      "ONE special romantic dinner (THE anniversary meal)",
      "Sunset or sunrise moment together",
      "Couples-focused activities (not group tours)",
      "Acknowledgment that this is a milestone celebration"
    ],
    atmosphere: "Romantic, intimate, meaningful. Quality time over quantity of activities. Celebrating their history.",
    promptAddition: '', // Built dynamically with buildAnniversaryPrompt()
    frequency: {
      specialDinner: 1,
      romanticMoment: 2,
      couplesActivity: 'daily'
    },
    pacingModifier: -1
  },

  honeymoon: {
    name: "Honeymoon",
    description: "Post-wedding celebration trip",
    mustInclude: [
      "Elevated experiences throughout",
      "Privacy and intimacy prioritized",
      "Special romantic moments",
      "Relaxation time (they just had a wedding)",
      "REST - they are EXHAUSTED from wedding planning"
    ],
    atmosphere: "Luxurious, romantic, restful. They're exhausted from wedding planning. Pamper them.",
    promptAddition: '', // Built dynamically with buildHoneymoonPrompt()
    frequency: {
      specialDinner: 2,
      romanticMoment: 'daily',
      restTime: 'daily',
      upgradeExperiences: true
    },
    pacingModifier: -2,
    upgradeExperiences: true
  },

  // ============ GROUP TRIPS ============

  solo: {
    name: "Solo Trip",
    description: "Traveling alone - the ultimate freedom",
    mustInclude: [
      "Solo-friendly dining at EVERY meal (counter seating, communal tables, casual spots)",
      "Activities that work well for one person",
      "Safe neighborhoods and well-lit evening routes",
      "Freedom/unstructured time blocks",
      "Social calibration based on archetype (social vs solitude)"
    ],
    atmosphere: "Empowering, safe, flexible. Solo travel is FREEDOM, not loneliness. Celebrate it.",
    promptAddition: '', // Will be built dynamically with buildSoloTripPrompt()
    frequency: {
      soloFriendlyDining: 'all meals - EVERY meal must have solo-friendly note',
      freedomBlock: 'daily - unstructured time for spontaneity',
      safeEvening: 'all evening activities in well-lit, populated areas'
    },
    pacingModifier: 0
  },

  girls_trip: {
    name: "Girls Trip",
    description: "Friends getaway (women)",
    mustInclude: [
      "Group-friendly activities",
      "Shareable food experiences (tapas, mezze, family-style)",
      "Photo-worthy moments and locations",
      "BRUNCH (mandatory for most girls trips)",
      "At least ONE evening out option",
      "Cute/aesthetic restaurant atmosphere"
    ],
    atmosphere: "Fun, bonding, celebratory. Shared experiences and memories. Photo-worthy.",
    promptAddition: '', // Built dynamically with buildGirlsTripPrompt()
    frequency: {
      groupActivity: 'daily',
      photoOp: 'daily',
      brunch: 'at least one',
      nightOut: '1-2 per trip'
    },
    pacingModifier: -1,
    bufferModifier: 15
  },

  guys_trip: {
    name: "Guys Trip",
    description: "Friends getaway (men)",
    mustInclude: [
      "Group-friendly activities that build memories",
      "Activity-based bonding (sports, adventures, tours)",
      "At least ONE evening bar/pub option",
      "Good food spots (not necessarily fancy, often casual)",
      "Something memorable/story-worthy ('remember when we...')"
    ],
    atmosphere: "Active, fun, bonding through shared experiences. Group energy visible throughout.",
    promptAddition: '', // Built dynamically with buildGuysTripPrompt()
    frequency: {
      groupActivity: 'daily',
      bondingActivity: 'at least one major',
      nightOut: '1-2 per trip'
    },
    pacingModifier: -1,
    bufferModifier: 15
  },

  family: {
    name: "Family Trip",
    description: "Traveling with children",
    mustInclude: [
      "Kid-friendly activities (interactive, not just looking)",
      "Family-friendly dining at KID times (lunch 12-13:00, dinner 17:30-18:30)",
      "REST TIME 13:00-15:00 daily (naps, pool, decompression)",
      "Activities END by 19:00-20:00",
      "Snack and bathroom considerations built in"
    ],
    atmosphere: "Fun for everyone, manageable logistics, creating family memories. Kids are NOT small adults.",
    promptAddition: '', // Built dynamically with buildFamilyPrompt()
    frequency: {
      kidActivity: 'daily',
      restTime: 'daily 13:00-15:00',
      familyMeal: 'all meals at kid-appropriate times'
    },
    pacingModifier: -2,
    bufferModifier: 30,
    maxActivitiesPerDay: 3
  },

  // ============ LIFE EVENTS ============

  babymoon: {
    name: "Babymoon",
    description: "Pre-baby celebration trip",
    mustInclude: [
      "Relaxation focus",
      "Pampering experiences",
      "Quality couple time",
      "NO adventure or strenuous activities"
    ],
    atmosphere: "Restful, indulgent, intimate. Last trip before baby arrives.",
    promptAddition: `
=== TRIP TYPE: BABYMOON ===

This is a BABYMOON - a couple's last trip before baby arrives.

The pregnant person is:
- Possibly tired
- Can't do certain activities
- May have food restrictions
- Needs more rest than normal

Include:
- Relaxation (pool, beach, spa if appropriate)
- Quality couple time
- Good food (but consider pregnancy restrictions)
- Gentle activities only
- Comfortable accommodations matter more than usual

DO NOT:
- Suggest adventure activities
- Plan strenuous hiking or walking
- Include raw fish restaurants without alternatives
- Forget rest time
- Pack the schedule
- Suggest alcohol-focused activities

Adjust to archetype:
- Beach Therapist babymoon = beach, pool, prenatal massage
- Culinary Cartographer babymoon = gentle food tours, nice dinners, cooking class
- Slow Traveler babymoon = very relaxed pace, cafes, scenic spots
`,
    frequency: {
      relaxation: 'daily',
      coupleTime: 'daily',
      gentleActivities: 'only'
    },
    pacingModifier: -3,
    excludeCategories: ['adventure_activity', 'extreme_sport', 'hiking', 'strenuous'],
    maxActivitiesPerDay: 2
  },

  retirement: {
    name: "Retirement Trip",
    description: "Celebrating retirement",
    mustInclude: [
      "Bucket list experiences",
      "Celebration moment",
      "Quality over quantity",
      "Comfortable pacing"
    ],
    atmosphere: "Celebratory, meaningful, well-deserved indulgence.",
    promptAddition: `
=== TRIP TYPE: RETIREMENT CELEBRATION ===

This person just RETIRED. This trip celebrates a major life achievement.

Include:
- ONE bucket list experience they've always wanted
- Celebration dinner
- Quality experiences (not rushing through)
- Comfortable pacing and accessibility
- Things they never had time for while working

DO NOT:
- Pack the schedule (they've earned rest)
- Suggest youth-focused venues
- Forget accessibility needs
- Make it feel like work (schedules, timelines)
- Skip the celebration element

Adjust to archetype:
- Milestone Voyager retirement = finally checking off that big item
- Slow Traveler retirement = ultimate slow travel, no clock
- Cultural Anthropologist retirement = deep cultural immersion they never had time for
`,
    frequency: {
      bucketListItem: 1,
      celebrationMoment: 1,
      comfortableExperience: 'daily'
    },
    pacingModifier: -2,
    upgradeExperiences: true
  },

  graduation: {
    name: "Graduation Trip",
    description: "Celebrating graduation",
    mustInclude: [
      "Celebration element",
      "Age-appropriate fun",
      "Photo opportunities",
      "Memorable experiences"
    ],
    atmosphere: "Celebratory, fun, marking a milestone.",
    promptAddition: `
=== TRIP TYPE: GRADUATION CELEBRATION ===

This trip celebrates a GRADUATION - educational milestone achieved.

Adjust for who graduated:
- High school grad = fun, social, supervised if with family
- College grad = independent, adventurous, budget-conscious probably
- Graduate degree = may be older, celebrating years of work

Include:
- Celebration moment (doesn't have to be dinner)
- Photo-worthy experiences
- Something memorable/story-worthy
- Age-appropriate nightlife if relevant

Adjust to archetype:
- Horizon Chaser + graduation = backpacker adventure, social scenes
- Adrenaline Architect + graduation = adventure activity they've earned
- Social Butterfly + graduation = group celebration, nightlife
`,
    frequency: {
      celebrationMoment: 1,
      photoOp: 'multiple',
      funExperience: 'daily'
    },
    pacingModifier: 0
  },

  bachelorette: {
    name: "Bachelorette Party",
    description: "Pre-wedding celebration for bride",
    mustInclude: [
      "Group celebration activities",
      "Photo opportunities",
      "Night out options",
      "Pampering/spa option"
    ],
    atmosphere: "Celebratory, fun, bonding. Last hurrah before marriage.",
    promptAddition: `
=== TRIP TYPE: BACHELORETTE PARTY ===

This is a BACHELORETTE - celebrating the bride-to-be.

Include:
- Group-friendly activities
- Photo-worthy moments (matching outfits, props, etc.)
- Night out / club / bar scene
- Optional spa/pampering
- Brunch culture
- Something memorable for the bride

Good activities:
- Pool/beach club
- Wine/cocktail tastings
- Spa day
- Dancing/clubs
- Group dinner at fun venue
- Activity the bride loves

DO NOT:
- Assume all bachelorettes want the same thing
- Forget the group dynamic
- Over-schedule (groups + drinking = slow)
- Make it uncomfortable for the bride

Match to bride's archetype - not all want clubs!
`,
    frequency: {
      groupActivity: 'daily',
      nightOut: '1-2 per trip',
      brideSpecial: 1
    },
    pacingModifier: -1,
    bufferModifier: 20
  },

  bachelor: {
    name: "Bachelor Party",
    description: "Pre-wedding celebration for groom",
    mustInclude: [
      "Group bonding activities",
      "Adventure or unique experience",
      "Night out options",
      "Memorable story-worthy moments"
    ],
    atmosphere: "Adventurous, fun, bonding. Celebrating with the guys.",
    promptAddition: `
=== TRIP TYPE: BACHELOR PARTY ===

This is a BACHELOR PARTY - celebrating the groom-to-be.

Include:
- Adventure or unique activity (the "story")
- Group bonding experiences
- Night out / bar scene
- Good food (fuel for activities)
- Something the groom specifically wants

Good activities:
- Outdoor adventures (golf, water sports, hiking)
- Sporting events
- Brewery/distillery tours
- Unique local experience
- Evening bar/club scene

DO NOT:
- Assume it's all about drinking
- Forget the group dynamic
- Over-schedule
- Make it uncomfortable for the groom

Match to groom's archetype - not all want Vegas-style!
`,
    frequency: {
      groupActivity: 'daily',
      nightOut: '1-2 per trip',
      adventureActivity: 1
    },
    pacingModifier: -1,
    bufferModifier: 20
  },

  // ============ SPECIAL PURPOSE ============

  wellness: {
    name: "Wellness Retreat",
    description: "Health and wellness focused",
    mustInclude: [
      "Daily wellness activities (yoga, spa, meditation)",
      "Healthy dining",
      "Rest and restoration",
      "Digital detox friendly"
    ],
    atmosphere: "Restorative, healthy, peaceful. This IS the purpose, not a side element.",
    promptAddition: `
=== TRIP TYPE: WELLNESS RETREAT ===

This trip's PURPOSE is WELLNESS. Not a vacation with spa added.

Include:
- Daily wellness activity (yoga, spa, meditation, treatments)
- Healthy dining options
- Rest and recovery time
- Nature/peaceful environments
- Digital detox opportunities

DO NOT:
- Add nightlife
- Pack the schedule with sightseeing
- Include heavy/unhealthy food
- Suggest strenuous activities unless requested
- Forget the purpose is restoration

This essentially makes them Wellness Devotee for this trip, regardless of base archetype.
`,
    frequency: {
      wellnessActivity: 'daily',
      healthyDining: 'all meals',
      restTime: 'daily'
    },
    pacingModifier: -3,
    overrideArchetypeFor: ['dining', 'activity_intensity']
  },

  adventure: {
    name: "Adventure Trip",
    description: "Focused on adventure activities",
    mustInclude: [
      "Adventure activity EVERY day (or every other day with recovery)",
      "At least ONE marquee adventure (THE experience of the trip)",
      "Recovery time after major activities",
      "Fuel-focused dining (energy, not ambiance)",
      "Trip should be 60%+ adventure activities"
    ],
    atmosphere: "Active, thrilling, challenging. Adventure IS the point, not sightseeing with one activity.",
    promptAddition: '', // Built dynamically with buildAdventurePrompt()
    frequency: {
      adventureActivity: 'daily or every other day',
      marqueeAdventure: 'at least 1',
      recoveryTime: 'after major activities'
    },
    overrideArchetypeFor: ['activity_selection'],
    pacingModifier: 1
  },

  foodie: {
    name: "Food & Culinary Trip",
    description: "Focused on culinary experiences",
    mustInclude: [
      "Food experiences 60%+ of itinerary",
      "At least ONE market visit",
      "At least ONE cooking class or food-making experience",
      "At least ONE signature restaurant (THE meal of the trip)",
      "EVERY meal intentional (no 'grab something quick')",
      "2-3 hours for sit-down meals"
    ],
    atmosphere: "Delicious, discovery, culinary immersion. Meals ARE the main events, not interruptions.",
    promptAddition: '', // Built dynamically with buildFoodiePrompt()
    frequency: {
      foodExperience: '2-3 daily',
      marketVisit: 'at least once',
      cookingClass: 'at least once',
      signatureMeal: '1-2 per trip'
    },
    overrideArchetypeFor: ['dining', 'activity_selection'],
    pacingModifier: -1
  },

  cultural: {
    name: "Cultural Exploration",
    description: "Deep cultural immersion",
    mustInclude: [
      "Museums and historical sites",
      "Local traditions and customs",
      "Authentic local experiences",
      "Cultural performances or events"
    ],
    atmosphere: "Immersive, educational, authentic. Understanding the destination deeply.",
    promptAddition: `
=== TRIP TYPE: CULTURAL EXPLORATION ===

This trip's PURPOSE is CULTURE. Deep understanding of the destination.

Include:
- Museums, galleries, historical sites
- Local traditions and customs
- Authentic neighborhood exploration
- Cultural performances, events, festivals
- Local guides for context

DO NOT:
- Rush through cultural sites
- Skip the "why" - always explain significance
- Make it superficial tourist activities
- Forget local food is part of culture
- Over-schedule (need time to absorb)

This essentially makes them Cultural Anthropologist for this trip, regardless of base archetype.
`,
    frequency: {
      culturalSite: 'daily',
      localExperience: 'daily',
      performance: '1-2 per trip'
    },
    overrideArchetypeFor: ['activity_selection'],
    pacingModifier: -1
  },

  business_leisure: {
    name: "Bleisure Trip",
    description: "Business trip with leisure extension",
    mustInclude: [
      "Work-friendly accommodations",
      "Efficient use of limited free time",
      "Easy logistics",
      "Option for client entertainment if needed"
    ],
    atmosphere: "Efficient, professional base with leisure optimization.",
    promptAddition: `
=== TRIP TYPE: BUSINESS + LEISURE ===

This person is extending a work trip. They have LIMITED free time.

Include:
- Efficient experiences (no wasted time)
- Near-hotel options for short windows
- One good dinner spot (possible client entertainment)
- Weekend full day if applicable
- Easy logistics (they're also working)

DO NOT:
- Plan full days when they're working
- Suggest anything too far from business area
- Forget they may be tired from work
- Over-schedule leisure time
- Ignore potential client entertainment needs
`,
    frequency: {
      efficientExperience: 'during free windows',
      clientDining: 'one option',
      weekendFull: 'if applicable'
    },
    pacingModifier: 1
  },

  romantic: {
    name: "Romantic Getaway",
    description: "Couples trip focused on romance",
    mustInclude: [
      "Intimate dining experiences",
      "Scenic romantic moments",
      "Couples activities",
      "Quality time together"
    ],
    atmosphere: "Romantic, intimate, connected. Focus on each other.",
    promptAddition: `
=== TRIP TYPE: ROMANTIC GETAWAY ===

This is a ROMANTIC trip for a couple.

Include:
- Intimate dining (not crowded tourist spots)
- Scenic moments (sunset, viewpoints, romantic settings)
- Couples activities (not just parallel experiences)
- Downtime for connection

DO NOT:
- Pack the schedule with sightseeing
- Suggest loud/crowded venues
- Forget atmosphere matters
- Schedule them apart
- Make it generic tourist trip

Adjust to archetype - romance looks different for everyone:
- Adrenaline Architect = adventure together builds connection
- Slow Traveler = long meals, walks, no rushing
- Culinary Cartographer = food experiences shared together
`,
    frequency: {
      romanticDinner: 'daily',
      scenicMoment: 'daily',
      couplesActivity: 'daily'
    },
    pacingModifier: -1
  },

  beach: {
    name: "Beach Vacation",
    description: "Sun, sea, and relaxation",
    mustInclude: [
      "Beach/pool time daily",
      "Water activities",
      "Relaxed dining",
      "Sunset moments"
    ],
    atmosphere: "Relaxed, sun-soaked, carefree. Beach IS the destination.",
    promptAddition: `
=== TRIP TYPE: BEACH VACATION ===

This is a BEACH trip. The beach/water is the main attraction.

Include:
- Beach or pool time daily
- Water activities (snorkeling, kayaking, boat trips)
- Casual beachside dining
- Sunset on the beach
- Minimal inland activities

DO NOT:
- Fill days with city sightseeing
- Forget the beach is why they're here
- Over-schedule activities
- Suggest formal dining
- Rush between activities
`,
    frequency: {
      beachTime: 'daily',
      waterActivity: '2-3 per trip',
      sunsetMoment: 'daily'
    },
    pacingModifier: -2
  },

  city_break: {
    name: "City Break",
    description: "Short urban exploration",
    mustInclude: [
      "Key city landmarks",
      "Local neighborhoods",
      "Urban food scene",
      "Nightlife option"
    ],
    atmosphere: "Energetic, urban, efficient. Make the most of limited time.",
    promptAddition: `
=== TRIP TYPE: CITY BREAK ===

This is a short CITY trip. Urban exploration is the focus.

Include:
- Key landmarks and attractions
- Local neighborhood exploration
- Urban food scene (restaurants, street food, markets)
- Nightlife/evening entertainment options
- Efficient use of time

DO NOT:
- Waste time on side trips outside the city
- Miss the iconic spots
- Forget local neighborhoods beyond tourist center
- Skip the food scene
- Over-relax (save beach mode for beach trips)
`,
    frequency: {
      landmark: 'daily',
      localNeighborhood: 'daily',
      urbanDining: 'all meals'
    },
    pacingModifier: 1
  },

  // ============ DEFAULT ============

  none: {
    name: "Standard Trip",
    description: "No special occasion",
    mustInclude: [],
    atmosphere: "Based purely on traveler archetype and preferences.",
    promptAddition: `
=== TRIP TYPE: STANDARD ===

No special occasion. Build itinerary purely based on:
- Traveler archetype
- Preferences
- Budget
- Pacing

No celebration elements required.
No special themes.
Just a great trip for who they are.
`,
    frequency: {},
    pacingModifier: 0
  }
};

/**
 * Get archetype × trip type interaction guidance
 */
export function getTripTypeInteraction(tripType: string, archetype: string): string {
  const normalizedArchetype = archetype?.toLowerCase().replace(/[_\s-]+/g, '_') || '';
  const normalizedTripType = tripType?.toLowerCase().replace(/[_\s-]+/g, '_') || 'none';

  const combinations: Record<string, Record<string, string>> = {
    // ═══════════════════════════════════════════════════════════════
    // GUYS TRIP - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    guys_trip: {
      // EXPLORERS
      cultural_anthropologist: "Historical pub crawl, local sports culture, traditional games locals play, authentic neighborhood bars.",
      urban_nomad: "Neighborhood bar hopping on foot, discovering local hangouts, street food crawl, rooftop beers.",
      wilderness_pioneer: "Group hiking, outdoor adventure day, kayaking or rafting, campfire vibes if possible.",
      digital_explorer: "Gaming bar, VR experiences, eSports venue, arcade night, tech district with craft beer.",
      flexible_wanderer: "Spontaneous pub discoveries, stumble into perfect local bars, group freedom to explore, no rigid plans.",
      // CONNECTORS
      social_butterfly: "Pub crawls, group tours, meeting locals, sports bar with atmosphere, maximum social energy.",
      family_architect: "Dad's trip away - sports, good food, relaxed pace, guilt-free guy time.",
      romantic_curator: "N/A - redirect to couples trip",
      community_builder: "Local community spots, neighborhood bars where regulars go, authentic local experience.",
      // ACHIEVERS
      bucket_list_conqueror: "Legendary stadium visit, famous brewery, iconic guys trip experience they've talked about.",
      adrenaline_architect: "Group adventure - skydiving, bungee, white water rafting, extreme shared experience.",
      collection_curator: "Brewery tour, whiskey tasting trail, sports memorabilia hunt, whatever the group geeks out on.",
      status_seeker: "VIP table, exclusive club, hard-to-get sports tickets, brag-worthy experience.",
      // RESTORERS
      zen_seeker: "Morning wellness solo, then join the guys. Balance personal practice with group evening.",
      retreat_regular: "Golf trip vibes, spa morning then guys activities, wellness-adjacent bonding.",
      beach_therapist: "Beach day, boat trip, sunset beers, casual seafood, low-key guys trip.",
      slow_traveler: "Long lunches, craft beer tastings, no rushing anywhere. Quality hang time over packed schedule.",
      // CURATORS
      culinary_cartographer: "Food and beer tour, BBQ pilgrimage, local specialty hunt, brewery crawl, hearty meals.",
      art_aficionado: "Architecture walk then drinks, design district then rooftop bar, culture by day, bars by night.",
      history_hunter: "Historical pub crawl, old-town walking tour, legendary sports venue visit, heritage district drinks.",
      luxury_luminary: "Premium everything - VIP sports box, high-end steakhouse, exclusive lounge, top-shelf whiskey.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable brewery, farm-to-table group dinner, eco-adventure activity, local craft producers.",
      gap_year_graduate: "Budget pub crawl, hostel social, cheap eats challenge, backpacker bar scene, maximum fun minimum cost.",
      midlife_explorer: "Grown-up guys trip - good restaurants, nice bars, one adventure activity, quality over quantity.",
      sabbatical_scholar: "Historical drinking tour, literary pub crawl, intellectual bonding over beers.",
      healing_journeyer: "Supportive friends trip - nature walks, meaningful conversations, gentle pace with the guys.",
      retirement_ranger: "Golf, wine tasting, comfortable pace, early dinners, quality time with old friends.",
      balanced_story_collector: "Mix of activities - some sports, some food, some nightlife, memorable shared experience."
    },

    // ═══════════════════════════════════════════════════════════════
    // GIRLS TRIP - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    girls_trip: {
      // EXPLORERS
      cultural_anthropologist: "Art galleries, cultural walking tour, women-owned businesses, meaningful local experiences.",
      urban_nomad: "Neighborhood exploration, cute cafes, boutique shopping streets, rooftop cocktails.",
      wilderness_pioneer: "Adventure retreat - hiking then wine, outdoor spa, glamping, nature bonding.",
      digital_explorer: "Instagram spots, trendy cafes, photo-worthy murals, aesthetic everything, night markets.",
      flexible_wanderer: "Wandering together, stumbling upon cute spots, spontaneous shopping finds, no rigid plans.",
      // CONNECTORS
      social_butterfly: "Group classes, wine tours, meeting locals, maximum social activities, evening out.",
      family_architect: "Mom's escape - spa day, wine, adult conversation, sleep in, no kids menu.",
      romantic_curator: "N/A - redirect to couples trip",
      community_builder: "Women's cooperatives, female artisan workshops, meaningful female-owned business visits.",
      // ACHIEVERS
      bucket_list_conqueror: "The bucket list destination, iconic photo spots, must-do experiences checked off.",
      adrenaline_architect: "Group adventure - surfing lesson, hiking, zip-lining, paddleboarding together.",
      collection_curator: "Shopping for their passion, specialty boutiques, curated finds, themed experiences.",
      status_seeker: "Influencer spots, exclusive brunches, VIP treatment, impressive venues, shareable moments.",
      // RESTORERS
      zen_seeker: "Wellness retreat vibes - yoga morning, healthy brunch, meditation, peaceful group activities.",
      retreat_regular: "Full spa day, wellness activities, healthy dining, treatments, relaxation focus.",
      beach_therapist: "Beach club day, pool lounging, sunset cocktails, casual beachwear shopping.",
      slow_traveler: "Long brunches, leisurely boutique browsing, no rushing, quality girlfriend time.",
      // CURATORS
      culinary_cartographer: "Food tour, cooking class together, wine tasting, restaurant hopping, market visit.",
      art_aficionado: "Gallery hopping, design districts, art-focused experiences, creative workshops.",
      history_hunter: "Historical walking tour, heritage museum, ancient quarter exploration, meaningful sites.",
      luxury_luminary: "Spa day, fine dining, luxury shopping, champagne everything, five-star treatment.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable fashion shopping, eco-spa, farm-to-table experiences, ethical brands.",
      gap_year_graduate: "Budget-friendly fun, hostels with style, cheap eats, backpacker adventures, thrift shopping.",
      midlife_explorer: "Grown-up girls trip - nice hotels, good food, meaningful experiences, celebrating friendship.",
      sabbatical_scholar: "Bookshop crawl, museum visits, intellectual cafes, cultural deep dives together.",
      healing_journeyer: "Supportive friends trip - gentle activities, nature walks, meaningful talks, holding space.",
      retirement_ranger: "Comfortable pace, nice restaurants, easy activities, celebrating years of friendship.",
      balanced_story_collector: "Mix of everything - shopping, culture, food, drinks, photos, memories."
    },

    // ═══════════════════════════════════════════════════════════════
    // BIRTHDAY - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    birthday: {
      // EXPLORERS
      cultural_anthropologist: "Birthday at meaningful historical site, special cultural experience, museum they love.",
      urban_nomad: "Birthday neighborhood discovery, surprise in a hidden local spot, urban exploration gift.",
      wilderness_pioneer: "Birthday summit hike, outdoor celebration, campfire birthday, nature experience.",
      digital_explorer: "Birthday at unique/viral venue, photo-worthy celebration, shareable moment.",
      flexible_wanderer: "Low-key birthday wander, stumble upon something special, no forced celebration.",
      // CONNECTORS
      social_butterfly: "Big birthday party, group dinner, festive atmosphere, all their friends energy.",
      family_architect: "Family birthday celebration, kid-friendly venue if with children, multi-generational.",
      romantic_curator: "Romantic birthday dinner, surprise experience planned by partner, intimate celebration.",
      community_builder: "Birthday giving back, celebration with local community, meaningful over material.",
      // ACHIEVERS
      bucket_list_conqueror: "Birthday bucket list item - THE thing they've always wanted to do. Make it happen.",
      adrenaline_architect: "Birthday adventure - skydiving, bungee, that thrilling thing they've wanted.",
      collection_curator: "Birthday related to their passion, adding to their collection, specialty experience.",
      status_seeker: "VIP birthday treatment, impressive venue, exclusive experience, show-stopping.",
      // RESTORERS
      zen_seeker: "Peaceful birthday - sunrise meditation, meaningful quiet celebration, spiritual significance.",
      retreat_regular: "Spa birthday, full pampering day, wellness celebration, treatments.",
      beach_therapist: "Beach birthday - sunset celebration, toes in sand, simple and perfect.",
      slow_traveler: "Leisurely birthday - long special lunch, no rushing, savoring the day.",
      // CURATORS
      culinary_cartographer: "Birthday at THE restaurant they've wanted, food-focused celebration.",
      art_aficionado: "Birthday at special gallery, private museum experience, art-related celebration.",
      history_hunter: "Birthday at a meaningful historical site, private guided tour, celebration with depth.",
      luxury_luminary: "Full luxury birthday - champagne, VIP everything, the works, make them feel royal.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable celebration, nature birthday experience, eco-conscious and meaningful.",
      gap_year_graduate: "Fun budget birthday, hostel party vibes, creative celebration, experience over expense.",
      midlife_explorer: "Meaningful milestone birthday, quality celebration, marking the moment.",
      sabbatical_scholar: "Birthday at meaningful historical or intellectual site, thoughtful celebration.",
      healing_journeyer: "Gentle birthday, peaceful celebration, self-care day, honoring the journey.",
      retirement_ranger: "Comfortable birthday celebration, quality over chaos, celebrating life.",
      balanced_story_collector: "Classic birthday - nice dinner, special moment, cake, making a memory."
    },

    // ═══════════════════════════════════════════════════════════════
    // ANNIVERSARY - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    anniversary: {
      // EXPLORERS
      cultural_anthropologist: "Anniversary exploring together, meaningful cultural site, learning as a couple.",
      urban_nomad: "City anniversary - romantic neighborhood walks, discovering spots together.",
      wilderness_pioneer: "Adventure anniversary - hiking, nature, outdoor romance, campfire under stars.",
      digital_explorer: "Modern anniversary - unique experiences, photo-worthy moments, shareable romance.",
      flexible_wanderer: "Wandering anniversary - no agenda, discover together, spontaneous romance.",
      // CONNECTORS
      social_butterfly: "Anniversary with friends nearby, celebratory energy, sharing the love.",
      family_architect: "Anniversary escape from kids, adult time, remembering why you fell in love.",
      romantic_curator: "Ultimate romantic anniversary - every detail planned, maximum romance.",
      community_builder: "Anniversary volunteering together, meaningful shared experience, giving back.",
      // ACHIEVERS
      bucket_list_conqueror: "Anniversary at dream destination, checking off together, romantic achievement.",
      adrenaline_architect: "Adventure anniversary - shared thrills, bonding through excitement.",
      collection_curator: "Anniversary focused on shared interest - wine region, art capitals together.",
      status_seeker: "Impressive anniversary - luxury, VIP, the kind others envy.",
      // RESTORERS
      zen_seeker: "Peaceful anniversary - meditation together, spiritual sites, quiet romance.",
      retreat_regular: "Spa anniversary - couple's treatments, wellness focus, relaxation.",
      beach_therapist: "Beach anniversary - ocean sunsets, simple romance, toes in sand together.",
      slow_traveler: "Slow anniversary - long meals, no rushing, savoring each moment together.",
      // CURATORS
      culinary_cartographer: "Food anniversary - cooking class together, restaurant tour, wine tasting.",
      art_aficionado: "Art anniversary - museums together, design experiences, cultural romance.",
      history_hunter: "History anniversary - ancient sites together, guided heritage walk, romantic old-town dinner.",
      luxury_luminary: "Luxury anniversary - five-star everything, private experiences, premium romance.",
      // TRANSFORMERS
      eco_ethicist: "Eco anniversary - sustainable resort, nature, responsible romance.",
      gap_year_graduate: "Budget anniversary - backpacker romance, meaningful over expensive.",
      midlife_explorer: "Mature anniversary - quality experiences, celebrating years together.",
      sabbatical_scholar: "Learning anniversary - exploring together, intellectual couple time.",
      healing_journeyer: "Healing anniversary - gentle, restorative, reconnecting.",
      retirement_ranger: "Later-life anniversary - comfortable, quality, no rushing.",
      balanced_story_collector: "Classic anniversary - romantic dinner, sunset, celebrating together."
    },

    // ═══════════════════════════════════════════════════════════════
    // HONEYMOON - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    honeymoon: {
      cultural_anthropologist: "Immersive honeymoon - learning together, cultural depth, meaningful sites.",
      urban_nomad: "City honeymoon - exploring neighborhoods together, romantic urban discovery.",
      wilderness_pioneer: "Adventure honeymoon - hiking, nature, outdoor romance, wilderness together.",
      digital_explorer: "Modern honeymoon - unique experiences, photo-worthy, aesthetically perfect.",
      flexible_wanderer: "Wandering honeymoon - no agenda, discover together, spontaneous romance.",
      social_butterfly: "Social honeymoon - cooking classes, tours with others, meeting couples.",
      family_architect: "N/A pre-kids, or blended family honeymoon with thoughtful kid inclusion.",
      romantic_curator: "Ultimate romantic honeymoon - every detail curated for maximum romance.",
      community_builder: "Meaningful honeymoon - volunteering together, starting marriage with purpose.",
      bucket_list_conqueror: "Dream destination honeymoon - must-sees with romantic lens.",
      adrenaline_architect: "Adventure honeymoon - shared thrills, building memories through excitement.",
      collection_curator: "Honeymoon around shared passion - wine region, art capitals, food tour.",
      status_seeker: "Impressive honeymoon - the kind that makes others jealous, VIP everything.",
      zen_seeker: "Peaceful honeymoon - meditation together, spiritual sites, quiet romance.",
      retreat_regular: "Spa honeymoon - couple's treatments, wellness focus, deep relaxation.",
      beach_therapist: "Beach honeymoon - ultimate relaxation, ocean, simple perfect romance.",
      slow_traveler: "Slow honeymoon - long meals, no rushing, savoring every newlywed moment.",
      culinary_cartographer: "Food honeymoon - cooking classes together, restaurant exploration.",
      art_aficionado: "Art honeymoon - museums together, design hotels, cultural romance.",
      history_hunter: "History honeymoon - ancient cities, heritage hotels, walking through centuries together.",
      luxury_luminary: "Luxury honeymoon - five-star everything, private experiences, premium.",
      eco_ethicist: "Eco honeymoon - sustainable resorts, nature, responsible romance.",
      gap_year_graduate: "Budget honeymoon - backpacker romance, meaningful over expensive.",
      midlife_explorer: "Mature honeymoon - quality over flash, meaningful experiences.",
      sabbatical_scholar: "Learning honeymoon - courses together, intellectual exploration.",
      healing_journeyer: "Healing honeymoon - gentle start to marriage, restorative.",
      retirement_ranger: "Later-life honeymoon - comfortable, quality, no rushing.",
      balanced_story_collector: "Classic honeymoon - mix of romance, sightseeing, relaxation."
    },

    // ═══════════════════════════════════════════════════════════════
    // SOLO - All 27 Archetypes (with rich social calibration)
    // ═══════════════════════════════════════════════════════════════
    solo: {
      // EXPLORERS
      cultural_anthropologist: "Deep solo immersion - museums YOUR pace, conversations with locals, no partner dragging you away from what interests YOU. Counter seating at local spots.",
      urban_nomad: "Ultimate city freedom - walk where you want, stop when you want, discover YOUR city. Counter seating, cafe people-watching, neighborhood wandering.",
      wilderness_pioneer: "Solo wilderness challenge - self-reliance, proving yourself, nature on your terms. Hut-to-hut hiking, camping alone, personal triumph.",
      digital_explorer: "Solo but connected - great wifi cafes, gaming spots that work alone, shareable moments for content. Tech-friendly solo venues.",
      flexible_wanderer: "Peak solo freedom - zero compromise, follow your whims, change plans whenever. This is what solo travel is FOR. No obligations, total spontaneity.",

      // CONNECTORS
      social_butterfly: "Solo but MEETING PEOPLE - walking tours, pub crawls, hostel events, food tours. You're alone but you won't be lonely. Communal tables, group activities.",
      family_architect: "Parent solo escape - adult time, sleep in, eat what YOU want, remember who you were before kids. Adult restaurants, peaceful mornings.",
      romantic_curator: "Solo self-romance - treating yourself, nice dinners alone (good bar seating), solo spa day. Self-love trip, self-dates to lovely venues.",
      community_builder: "Solo volunteering - meaningful solo travel, connecting through giving back, locals over tourists. Community kitchens, local projects.",

      // ACHIEVERS  
      bucket_list_conqueror: "Solo bucket list efficiency - no compromise, YOUR priorities, YOUR pace. Skip what doesn't interest you. Skip-the-line solo entry.",
      adrenaline_architect: "Solo adventure proving ground - personal challenges, self-reliance, your limits not someone else's. Solo-friendly adventure operators.",
      collection_curator: "Solo deep dive - FULL focus on your interest. No one bored by your passion. Hours in one museum if you want. Specialty shops at your pace.",
      status_seeker: "Solo luxury treating yourself - chef's counter (premium solo spot), spa, best experiences for one. VIP doesn't require pairs.",

      // RESTORERS
      zen_seeker: "Solo spiritual journey - meditation retreat, temple solitude, silence. Alone is the practice. Peaceful cafes, mindful walks, inner focus.",
      retreat_regular: "Solo wellness reset - spa treatments, yoga, personal restoration. Healing happens alone. No one else's schedule.",
      beach_therapist: "Solo beach therapy - ocean, book, napping, eating when hungry. Simple solo paradise. Casual beachside cafes, sunset watching alone.",
      slow_traveler: "Ultimate solo slow travel - no negotiation about pace. YOUR long coffee. YOUR 2-hour lunch. YOUR nap. Cafes with books, parks, gardens.",

      // CURATORS
      culinary_cartographer: "Solo food journey - counter seating heaven (sushi bars, tapas counters), food tours, markets. Food people understand solo diners. Chef's table for one.",
      art_aficionado: "Solo art immersion - hours in front of one painting if you want. No one saying 'ready to go?' Museum heaven, gallery wandering, bookshops.",
      luxury_luminary: "Solo luxury indulgence - treat yourself to the best. Chef's counter, spa day, premium everything for one. Solo doesn't mean lesser experience.",

      // TRANSFORMERS
      eco_ethicist: "Solo eco travel - minimal footprint, meaningful solo connections with nature and locals. Sustainable lodges, conservation experiences, quiet impact.",
      gap_year_graduate: "Classic solo backpacking - hostels with social scene, meeting travelers, cheap eats, freedom. Pub crawls, free walking tours, communal spaces.",
      midlife_explorer: "Solo rediscovery - finding yourself again, new experiences, complete freedom to reinvent. Quality solo dining, thoughtful experiences.",
      sabbatical_scholar: "Solo intellectual journey - libraries, bookshops, courses. Learning alone is learning best. Quiet cafes for reading/writing.",
      healing_journeyer: "Solo healing journey - solitude as medicine. Space to feel. Nature. Journaling spots. Gentle cafes. No forced interaction. Peace.",
      retirement_ranger: "Solo retirement adventure - finally doing exactly what YOU want. No compromise. Your time. Comfortable solo dining, accessible pacing.",
      balanced_story_collector: "Balanced solo trip - mix of activities, some social options, complete flexibility. Walking tours optional, good cafes, own rhythm."
    },

    // ═══════════════════════════════════════════════════════════════
    // FAMILY - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    family: {
      cultural_anthropologist: "Educational family trip - kid-friendly history, interactive museums, learning fun.",
      urban_nomad: "Family city exploration - parks, playgrounds, kid-friendly neighborhoods.",
      wilderness_pioneer: "Family outdoor adventure - easy hikes, nature centers, age-appropriate camping.",
      digital_explorer: "Family tech fun - science museums, aquariums, interactive digital exhibits.",
      flexible_wanderer: "Flexible family - go with kid energy, spontaneous park stops, no rigid schedule.",
      social_butterfly: "Social family trip - activities with other families, kid-friendly group tours.",
      family_architect: "Ultimate family trip - perfectly planned for all ages, everyone considered.",
      romantic_curator: "Family trip with couple moments - one parents' date night, babysitter arranged.",
      community_builder: "Family volunteering - age-appropriate giving back, teaching kids to help.",
      bucket_list_conqueror: "Family bucket list - theme parks, zoos, must-do family experiences.",
      adrenaline_architect: "Adventure family - age-appropriate thrills, water parks, easy adventures.",
      collection_curator: "Family learning trip - focused on kids' interests, what they love.",
      status_seeker: "Impressive family trip - best resorts, VIP family experiences, kids club.",
      zen_seeker: "Calm family trip - nature, peaceful activities, mindful family time.",
      retreat_regular: "Family wellness - kid-friendly resort, family spa, healthy activities.",
      beach_therapist: "Beach family trip - sandcastles, swimming, ice cream, simple kid fun.",
      slow_traveler: "Slow family trip - no rushing, long beach days, relaxed kid pace.",
      culinary_cartographer: "Foodie family - cooking classes, food tours, teaching kids about food.",
      art_aficionado: "Art family - kid-friendly museums, hands-on art activities, creative fun.",
      luxury_luminary: "Luxury family - five-star family resorts, kids clubs, family suites.",
      eco_ethicist: "Eco family - teaching sustainability, nature, conservation experiences.",
      gap_year_graduate: "Budget family - camping, picnics, free activities, creative fun.",
      midlife_explorer: "Multi-gen family - activities for all ages, quality family time.",
      sabbatical_scholar: "Educational family - learning experiences, historical sites, curious kids.",
      healing_journeyer: "Gentle family trip - nature, bonding, peaceful family activities.",
      retirement_ranger: "Grandparent trip - comfortable pace, making memories with grandkids.",
      balanced_story_collector: "Classic family vacation - mix of everything, something for everyone."
    },

    // ═══════════════════════════════════════════════════════════════
    // BABYMOON - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    babymoon: {
      cultural_anthropologist: "Gentle cultural babymoon - easy museums, no long walks, comfortable pace.",
      urban_nomad: "City babymoon - comfortable neighborhoods, frequent rest stops, gentle exploration.",
      wilderness_pioneer: "Nature babymoon - scenic drives, easy walks, nature viewing, no strenuous activity.",
      digital_explorer: "Modern babymoon - comfortable unique experiences, easy photo spots.",
      flexible_wanderer: "Relaxed babymoon - no plans, rest when needed, gentle wandering.",
      social_butterfly: "Connected babymoon - comfortable group activities, prenatal yoga class.",
      family_architect: "N/A - this IS the pre-family trip.",
      romantic_curator: "Romantic babymoon - last couple trip before baby, intimate and gentle.",
      community_builder: "Meaningful babymoon - gentle volunteering, comfortable connections.",
      bucket_list_conqueror: "Bucket list babymoon - comfortable must-sees before baby arrives.",
      adrenaline_architect: "MODIFIED - no adventure activities. Redirect to scenic, easy experiences.",
      collection_curator: "Gentle interest babymoon - easy version of their passion.",
      status_seeker: "Luxury babymoon - premium pampering, first-class comfort.",
      zen_seeker: "Peaceful babymoon - prenatal yoga, meditation, spiritual preparation.",
      retreat_regular: "Spa babymoon - prenatal treatments, ultimate pampering, rest.",
      beach_therapist: "Beach babymoon - lounging, gentle swimming, relaxation.",
      slow_traveler: "Ultimate slow babymoon - no rushing ever, complete rest.",
      culinary_cartographer: "Food babymoon - pregnancy-safe dining focus, gentle food tours.",
      art_aficionado: "Art babymoon - museums at easy pace, seated viewing options.",
      luxury_luminary: "Luxury babymoon - five-star pampering, every comfort anticipated.",
      eco_ethicist: "Eco babymoon - sustainable resort, gentle nature, peaceful.",
      gap_year_graduate: "Budget babymoon - comfortable basics, rest focus over activities.",
      midlife_explorer: "Meaningful babymoon - quality rest before this new chapter.",
      sabbatical_scholar: "Gentle learning babymoon - easy cultural experiences.",
      healing_journeyer: "Restful babymoon - preparing body and mind, peaceful.",
      retirement_ranger: "N/A - not typical demographic.",
      balanced_story_collector: "Classic babymoon - mix of rest and gentle activities."
    },

    // ═══════════════════════════════════════════════════════════════
    // GRADUATION - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    graduation: {
      // EXPLORERS
      cultural_anthropologist: "Educational celebration - meaningful historical site, cultural depth, honoring the learning journey.",
      urban_nomad: "City graduation trip - neighborhood exploration, celebrating freedom, urban adventure begins.",
      wilderness_pioneer: "Outdoor graduation celebration - summit hike, nature adventure, conquering new heights.",
      digital_explorer: "Modern graduation trip - Instagram-worthy moments, trendy spots, shareable celebration.",
      flexible_wanderer: "Freedom graduation trip - no more schedules, pure spontaneity, celebrating independence.",
      // CONNECTORS
      social_butterfly: "Party graduation - group celebration, meeting people, nightlife, maximum social energy.",
      family_architect: "Family graduation celebration - multi-generational trip, making parents proud, shared joy.",
      romantic_curator: "Couples graduation trip - celebrating together, romantic milestone marking.",
      community_builder: "Meaningful graduation - volunteering, giving back, starting next chapter with purpose.",
      // ACHIEVERS
      bucket_list_conqueror: "Bucket list graduation - THE trip you've been waiting for, reward for years of work.",
      adrenaline_architect: "Adventure graduation - you earned this thrill, skydiving, bungee, epic experience.",
      collection_curator: "Passion graduation trip - deep dive into your interest, celebrating your expertise.",
      status_seeker: "Impressive graduation trip - brag-worthy destination, VIP experiences, Instagram gold.",
      // RESTORERS
      zen_seeker: "Peaceful graduation - rest after years of stress, meditation, finding center before next chapter.",
      retreat_regular: "Wellness graduation - spa recovery from finals, treatments, restoring depleted energy.",
      beach_therapist: "Beach graduation - finally relaxing, ocean therapy, decompressing from academic stress.",
      slow_traveler: "Slow graduation trip - no deadlines, no rushing, savoring freedom at last.",
      // CURATORS
      culinary_cartographer: "Foodie graduation - eating your way through celebration, food adventures, no meal plan budget.",
      art_aficionado: "Art graduation - museums without rush, cultural immersion, feeding creativity.",
      luxury_luminary: "Luxury graduation - treating yourself after sacrifice, premium everything, you earned it.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable graduation - eco-conscious celebration, nature, starting career with values.",
      gap_year_graduate: "Budget graduation adventure - backpacking, hostels, stretching graduation money far.",
      midlife_explorer: "Career-change graduation - celebrating reinvention, meaningful new chapter.",
      sabbatical_scholar: "Academic graduation - intellectual celebration, bookshops, scholarly satisfaction.",
      healing_journeyer: "Gentle graduation - recovering from academic pressure, peaceful transition.",
      retirement_ranger: "Late-life graduation - celebrating lifelong learning, comfortable pace.",
      balanced_story_collector: "Classic graduation trip - mix of celebration, relaxation, and adventure."
    },

    // ═══════════════════════════════════════════════════════════════
    // RETIREMENT - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    retirement: {
      // EXPLORERS
      cultural_anthropologist: "Cultural retirement trip - finally time for deep immersion, meaningful exploration, no work calls.",
      urban_nomad: "City retirement exploration - walking cities at your pace, no schedule, urban freedom.",
      wilderness_pioneer: "Outdoor retirement - hiking bucket list, nature immersion, active retirement celebration.",
      digital_explorer: "Modern retirement trip - unique experiences, photo-worthy moments, staying current.",
      flexible_wanderer: "Freedom retirement - no more schedules ever, pure spontaneity, earned independence.",
      // CONNECTORS
      social_butterfly: "Social retirement - group tours, meeting fellow travelers, cruises, new friendships.",
      family_architect: "Family retirement trip - traveling with grandkids, multi-generational memories.",
      romantic_curator: "Romantic retirement - second honeymoon energy, celebrating partnership through career.",
      community_builder: "Meaningful retirement - volunteering abroad, giving back with new free time.",
      // ACHIEVERS
      bucket_list_conqueror: "Ultimate bucket list - THE destinations you've always dreamed of, no more 'someday'.",
      adrenaline_architect: "Active retirement - proving age is just a number, adventure within ability.",
      collection_curator: "Passion retirement - finally time for your hobby, deep expertise trips.",
      status_seeker: "Impressive retirement - luxury travel you've earned, premium experiences, bragging rights.",
      // RESTORERS
      zen_seeker: "Peaceful retirement - spiritual exploration, meditation retreats, finding meaning.",
      retreat_regular: "Wellness retirement - spa trips, health focus, taking care of yourself finally.",
      beach_therapist: "Beach retirement - ocean time, relaxation, simple pleasures, no alarm clocks.",
      slow_traveler: "Slow retirement travel - ultimate slow travel, weeks not days, no rushing ever.",
      // CURATORS
      culinary_cartographer: "Foodie retirement - food tours, cooking classes, culinary bucket list.",
      art_aficionado: "Art retirement - museums without rushing, cultural immersion, lifelong learning.",
      luxury_luminary: "Luxury retirement - five-star everything, you worked for this, premium treatment.",
      // TRANSFORMERS
      eco_ethicist: "Eco retirement - sustainable travel, nature, leaving good footprint.",
      gap_year_graduate: "Budget retirement adventure - stretching savings, smart travel, experience over luxury.",
      midlife_explorer: "N/A - retirement is past midlife, redirect to retirement_ranger.",
      sabbatical_scholar: "Learning retirement - courses, lectures, intellectual travel, lifelong student.",
      healing_journeyer: "Healing retirement - rest from career stress, gentle recovery, peace.",
      retirement_ranger: "Classic retirement travel - comfortable pace, quality experiences, celebrating life's work.",
      balanced_story_collector: "Balanced retirement - mix of bucket list, relaxation, and new experiences."
    },

    // ═══════════════════════════════════════════════════════════════
    // WELLNESS RETREAT - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    wellness_retreat: {
      // EXPLORERS
      cultural_anthropologist: "Cultural wellness - local healing traditions, traditional medicine, indigenous wellness practices.",
      urban_nomad: "Urban wellness - city yoga studios, juice bars, wellness neighborhoods, mindful city walking.",
      wilderness_pioneer: "Nature wellness - forest bathing, outdoor yoga, wilderness therapy, hiking meditation.",
      digital_explorer: "Modern wellness - biohacking centers, wellness tech, meditation apps, infrared saunas.",
      flexible_wanderer: "Flexible wellness - drop-in classes, no rigid schedule, intuitive self-care.",
      // CONNECTORS
      social_butterfly: "Group wellness - retreat with others, group yoga, wellness community, shared healing.",
      family_architect: "Family wellness - kid-friendly wellness resort, family yoga, healthy habits together.",
      romantic_curator: "Couples wellness - partner yoga, couples massage, romantic health retreat.",
      community_builder: "Community wellness - wellness volunteering, teaching yoga, sharing healing.",
      // ACHIEVERS
      bucket_list_conqueror: "Achievement wellness - complete a program, yoga teacher training, wellness certification.",
      adrenaline_architect: "Active wellness - intensive fitness retreat, challenging yoga, athletic recovery.",
      collection_curator: "Specialist wellness - deep dive into specific practice, Ayurveda immersion, expertise.",
      status_seeker: "Premium wellness - exclusive retreat, celebrity-level facilities, impressive program.",
      // RESTORERS
      zen_seeker: "Spiritual wellness - meditation intensive, silent retreat, deep practice, enlightenment focus.",
      retreat_regular: "Full wellness immersion - comprehensive program, daily treatments, total reset.",
      beach_therapist: "Beach wellness - oceanside yoga, beach meditation, water therapy, natural healing.",
      slow_traveler: "Gentle wellness - no intensive programs, slow yoga, rest-focused, easy pace.",
      // CURATORS
      culinary_cartographer: "Nutrition wellness - healthy cooking, detox cuisine, food as medicine, clean eating.",
      art_aficionado: "Creative wellness - art therapy, creative expression, healing through art.",
      luxury_luminary: "Luxury wellness - six-star spa resort, premium treatments, world-class facilities.",
      // TRANSFORMERS
      eco_ethicist: "Eco wellness - sustainable retreat, organic everything, nature connection, earth healing.",
      gap_year_graduate: "Budget wellness - affordable retreat, work-exchange yoga, hostel yoga classes.",
      midlife_explorer: "Transformative wellness - midlife reset, health reboot, new chapter preparation.",
      sabbatical_scholar: "Learning wellness - wellness education, understanding the science, intellectual approach.",
      healing_journeyer: "Deep healing retreat - trauma-informed, therapeutic focus, professional support.",
      retirement_ranger: "Gentle wellness - age-appropriate, restorative, comfortable healing.",
      balanced_story_collector: "Balanced wellness - mix of activity, rest, treatments, and learning."
    },

    // ═══════════════════════════════════════════════════════════════
    // ADVENTURE TRIP - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    adventure: {
      // EXPLORERS
      cultural_anthropologist: "Cultural adventure - adventurous local experiences, off-grid communities, challenging cultural immersion.",
      urban_nomad: "Urban adventure - parkour spots, urban climbing, city challenges, underground exploration.",
      wilderness_pioneer: "Ultimate wilderness adventure - multi-day trek, mountaineering, expedition-level.",
      digital_explorer: "Tech adventure - drone photography spots, GoPro moments, shareable thrills.",
      flexible_wanderer: "Spontaneous adventure - no fixed plan, say yes to opportunities, organic thrills.",
      // CONNECTORS
      social_butterfly: "Group adventure - adventure tours, meeting fellow thrill-seekers, shared adrenaline.",
      family_architect: "Family adventure - age-appropriate thrills, adventure parks, safe excitement.",
      romantic_curator: "Couples adventure - tandem skydiving, couples surf lessons, bonding through thrills.",
      community_builder: "Purposeful adventure - conservation expeditions, meaningful challenges.",
      // ACHIEVERS
      bucket_list_conqueror: "Bucket list adventure - THE thing you've always wanted to do, epic achievement.",
      adrenaline_architect: "Maximum adventure - extreme everything, pushing limits, ultimate thrills.",
      collection_curator: "Specialist adventure - deep expertise in one activity, skill progression.",
      status_seeker: "Impressive adventure - brag-worthy experiences, exclusive access, Instagram gold.",
      // RESTORERS
      zen_seeker: "Mindful adventure - adventure as meditation, present-moment focus, flow states.",
      retreat_regular: "Recovery adventure - active recovery, challenging but balanced, spa after.",
      beach_therapist: "Water adventure - surfing, diving, kiteboarding, ocean-based thrills.",
      slow_traveler: "Gentle adventure - hiking not climbing, kayaking not rapids, accessible thrills.",
      // CURATORS
      culinary_cartographer: "Food adventure - extreme food experiences, foraging, survival cooking.",
      art_aficionado: "Creative adventure - adventure photography, capturing the extreme, artistic thrills.",
      luxury_luminary: "Luxury adventure - heli-skiing, private guides, premium adventure experiences.",
      // TRANSFORMERS
      eco_ethicist: "Eco adventure - sustainable expeditions, conservation adventures, leave no trace.",
      gap_year_graduate: "Budget adventure - cheap thrills, backpacker adventures, DIY adrenaline.",
      midlife_explorer: "Midlife adventure - proving yourself, new challenges, age-defying experiences.",
      sabbatical_scholar: "Learning adventure - understanding the science, skilled progression, expert instruction.",
      healing_journeyer: "Therapeutic adventure - adventure therapy, overcoming fears, building confidence.",
      retirement_ranger: "Accessible adventure - within physical ability, safe thrills, proving vitality.",
      balanced_story_collector: "Mixed adventure - variety of activities, some intense, some moderate."
    },

    // ═══════════════════════════════════════════════════════════════
    // FOODIE TRIP - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    foodie: {
      // EXPLORERS
      cultural_anthropologist: "Cultural food immersion - understanding food history, traditional techniques, food as culture.",
      urban_nomad: "Street food crawl - neighborhood eating, market hopping, local joints, walking food tour.",
      wilderness_pioneer: "Foraging foodie - wild food, farm visits, source-to-table, outdoor cooking.",
      digital_explorer: "Instagrammable food - aesthetic cafes, trendy spots, viral restaurants, food content.",
      flexible_wanderer: "Spontaneous foodie - no reservations, follow your nose, discover hidden gems.",
      // CONNECTORS
      social_butterfly: "Social food experience - group cooking classes, food tours, communal dining, chef's tables.",
      family_architect: "Family food adventure - kid-friendly cooking classes, food tours with children, teaching food.",
      romantic_curator: "Romantic food journey - couples cooking class, intimate dinners, wine pairings.",
      community_builder: "Community food - home dining experiences, local family meals, food cooperatives.",
      // ACHIEVERS
      bucket_list_conqueror: "Bucket list restaurants - THE places you've always wanted to eat, famous chefs.",
      adrenaline_architect: "Extreme food - bizarre foods, spicy challenges, food adventures, eating dares.",
      collection_curator: "Specialist foodie - deep dive into one cuisine, wine expertise, cheese mastery.",
      status_seeker: "Elite dining - Michelin stars, hard reservations, celebrity chef experiences, bragging rights.",
      // RESTORERS
      zen_seeker: "Mindful eating - slow food, meditation before meals, food as spiritual practice.",
      retreat_regular: "Wellness foodie - healthy gourmet, spa cuisine, nutritional excellence.",
      beach_therapist: "Seafood journey - coastal cuisine, beachside dining, fresh catch, ocean flavors.",
      slow_traveler: "Slow food pilgrimage - long lunches, savoring every bite, meal as destination.",
      // CURATORS
      culinary_cartographer: "Ultimate food obsession - every meal researched, maximum food experiences, total immersion.",
      art_aficionado: "Artistic dining - beautiful presentation, design-forward restaurants, food as art.",
      luxury_luminary: "Luxury gastronomy - tasting menus, rare ingredients, premium wine pairings, five-star dining.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable foodie - farm-to-table, organic, zero-waste restaurants, ethical eating.",
      gap_year_graduate: "Budget foodie - cheap eats, street food, market meals, maximum flavor minimum cost.",
      midlife_explorer: "Culinary awakening - new cuisines, cooking skills, food education, expanding palate.",
      sabbatical_scholar: "Food education - culinary school, understanding technique, wine certifications.",
      healing_journeyer: "Comfort food journey - nourishing meals, food as healing, gentle culinary exploration.",
      retirement_ranger: "Leisurely food tour - long lunches, comfortable dining, accessible restaurants.",
      balanced_story_collector: "Balanced food trip - mix of fine dining, street food, cooking classes, markets."
    },

    // ═══════════════════════════════════════════════════════════════
    // BUSINESS LEISURE (Bleisure) - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    business_leisure: {
      // EXPLORERS
      cultural_anthropologist: "Cultural bleisure - squeeze in museums, historical sites during breaks, evening cultural walks.",
      urban_nomad: "Urban bleisure - explore neighborhoods near conference, walking between meetings, city discovery.",
      wilderness_pioneer: "Active bleisure - morning runs, weekend nature escape, outdoor breaks.",
      digital_explorer: "Tech bleisure - visit tech districts, innovative cafes, work-friendly unique spaces.",
      flexible_wanderer: "Opportunistic bleisure - grab free moments, spontaneous discoveries, flexible exploring.",
      // CONNECTORS
      social_butterfly: "Networking bleisure - client dinners, colleague outings, business social events.",
      family_architect: "Family extension - bring family for weekend after work, kid-friendly additions.",
      romantic_curator: "Partner bleisure - partner joins for weekend, romantic extension after business.",
      community_builder: "Meaningful bleisure - local business connections, community visits during gaps.",
      // ACHIEVERS
      bucket_list_conqueror: "Efficient bleisure - hit major landmarks in limited time, maximize free hours.",
      adrenaline_architect: "Active bleisure - morning workouts, adventure day after conference, active breaks.",
      collection_curator: "Specialist bleisure - visit specific interest during free time, targeted experiences.",
      status_seeker: "Impressive bleisure - best restaurants for client dinners, VIP experiences, show off city.",
      // RESTORERS
      zen_seeker: "Wellness bleisure - hotel yoga, meditation apps, peaceful moments between meetings.",
      retreat_regular: "Spa bleisure - hotel spa after work, wellness morning routine, recovery.",
      beach_therapist: "Beach bleisure - beach lunch break, coastal weekend, ocean time if near water.",
      slow_traveler: "Restful bleisure - don't overschedule free time, quality over quantity, actual rest.",
      // CURATORS
      culinary_cartographer: "Food bleisure - research best restaurants, local specialties, food-focused free time.",
      art_aficionado: "Art bleisure - galleries during lunch, museum after conference, cultural evenings.",
      luxury_luminary: "Premium bleisure - upgrade hotel, expense account dinners, luxury free time.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable bleisure - eco-conscious choices, sustainable restaurants, green options.",
      gap_year_graduate: "Budget bleisure - save per diem, cheap local eats, budget explorations.",
      midlife_explorer: "Meaningful bleisure - make work trips count, quality experiences in limited time.",
      sabbatical_scholar: "Learning bleisure - bookshops, lectures if available, intellectual additions.",
      healing_journeyer: "Gentle bleisure - don't overdo it, rest between work, gentle exploration.",
      retirement_ranger: "N/A - not typical for retirees, redirect to leisure trip.",
      balanced_story_collector: "Balanced bleisure - mix of rest, food, sights in available time."
    }
  };

  const combo = combinations[normalizedTripType]?.[normalizedArchetype];

  if (combo) {
    return `
=== ${tripType.toUpperCase()} + ${archetype.replace(/_/g, ' ').toUpperCase()} ===
${combo}

Synthesize BOTH inputs:
- Trip type (${tripType}) shapes WHAT to include
- Archetype (${archetype}) shapes HOW they experience it
`;
  }

  return '';
}

/**
 * Get the trip type modifier, with fallback to 'none'
 */
export function getTripTypeModifier(tripType: string | undefined | null): TripTypeModifier {
  if (!tripType || tripType === 'undefined' || tripType === 'null') {
    return tripTypeModifiers.none;
  }

  const normalized = tripType.toLowerCase().replace(/[\s-]+/g, '_');
  return tripTypeModifiers[normalized] || tripTypeModifiers.none;
}

/**
 * Build the complete trip type prompt section
 */
export function buildTripTypePromptSection(
  tripType: string | undefined | null,
  archetype: string,
  totalDays: number,
  celebrationDay?: number
): string {
  const modifier = getTripTypeModifier(tripType);
  const interaction = getTripTypeInteraction(tripType || 'none', archetype);
  const normalizedType = (tripType || '').toLowerCase().replace(/[\s-]+/g, '_');

  if (modifier.name === 'Standard Trip' && !interaction) {
    return ''; // No special trip type guidance needed
  }

  // Build dynamic prompt content based on trip type
  let promptContent = '';
  
  switch (normalizedType) {
    case 'solo':
      promptContent = buildSoloTripPrompt(archetype);
      break;
    case 'honeymoon':
      promptContent = buildHoneymoonPrompt();
      break;
    case 'family':
      promptContent = buildFamilyPrompt();
      break;
    case 'babymoon':
      promptContent = buildBabymoonPrompt();
      break;
    case 'birthday':
      promptContent = buildBirthdayPrompt(archetype, celebrationDay, totalDays);
      break;
    case 'anniversary':
      promptContent = buildAnniversaryPrompt();
      break;
    case 'guys_trip':
      promptContent = buildGuysTripPrompt();
      break;
    case 'girls_trip':
      promptContent = buildGirlsTripPrompt();
      break;
    case 'adventure':
      promptContent = buildAdventurePrompt();
      break;
    case 'foodie':
    case 'culinary':
      promptContent = buildFoodiePrompt();
      break;
    case 'wellness':
    case 'wellness_retreat':
      promptContent = buildWellnessPrompt();
      break;
    default:
      // Use the existing promptAddition from the modifier
      promptContent = modifier.promptAddition || '';
  }

  let section = `
══════════════════════════════════════════════════════════════════════
                          TRIP TYPE REQUIREMENTS
══════════════════════════════════════════════════════════════════════

${promptContent}
`;

  // Add frequency rules
  if (Object.keys(modifier.frequency).length > 0) {
    section += `
=== FREQUENCY RULES ===
${Object.entries(modifier.frequency).map(([key, value]) =>
      `- ${key.replace(/_/g, ' ')}: ${value}`
    ).join('\n')}
`;
  }

  // Add excluded categories
  if (modifier.excludeCategories && modifier.excludeCategories.length > 0) {
    section += `
=== EXCLUDED FOR THIS TRIP TYPE ===
DO NOT include activities in these categories: ${modifier.excludeCategories.join(', ')}
`;
  }

  // Add pacing modifier
  if (modifier.pacingModifier && modifier.pacingModifier !== 0) {
    const pacingDirection = modifier.pacingModifier < 0 ? 'SLOWER' : 'FASTER';
    section += `
=== PACING ADJUSTMENT ===
This trip type requires ${pacingDirection} pacing than normal (modifier: ${modifier.pacingModifier > 0 ? '+' : ''}${modifier.pacingModifier})
${modifier.pacingModifier < -2 ? 'VERY relaxed schedule. Maximum 2-3 activities per day.' : ''}
${modifier.pacingModifier > 0 ? 'More efficient scheduling. Make the most of available time.' : ''}
`;
  }

  // Add max activities if specified
  if (modifier.maxActivitiesPerDay) {
    section += `
HARD LIMIT: Maximum ${modifier.maxActivitiesPerDay} scheduled activities per day for this trip type.
`;
  }

  // Add archetype interaction text (descriptive guidance)
  if (interaction) {
    section += `
=== ARCHETYPE × TRIP TYPE STYLE ===
${interaction}
`;
  }

  // Add structured interaction rules (override/combine/amplify with priorities)
  const interactionRules = getArchetypeInteraction(normalizedType, archetype);
  if (interactionRules) {
    section += `
═══════════════════════════════════════════════════════════════════════════
TRIP TYPE × ARCHETYPE INTERACTION RULES
═══════════════════════════════════════════════════════════════════════════

Interaction Type: ${interactionRules.interaction.toUpperCase()}
${interactionRules.description}

The hierarchy for this trip:
1. TRIP TYPE sets WHAT (purpose, constraints, safety requirements)
2. ARCHETYPE determines HOW (style, expression within those constraints)
3. TRAITS fine-tune (exact calibration)
`;

    if (interactionRules.priorityShift.length > 0) {
      section += `
=== PRIORITIZE THESE (move to top of experience list) ===
${interactionRules.priorityShift.map(p => `✓ ${p}`).join('\n')}
`;
    }

    if (interactionRules.deprioritize.length > 0) {
      section += `
=== DEPRIORITIZE THESE (move down or remove) ===
${interactionRules.deprioritize.map(d => `✗ ${d}`).join('\n')}
`;
    }

    if (interactionRules.hardConstraints && interactionRules.hardConstraints.length > 0) {
      section += `
=== HARD CONSTRAINTS (CANNOT be violated regardless of archetype) ===
${interactionRules.hardConstraints.map(c => `🚫 ${c}`).join('\n')}
`;
    }

    // Add effective pacing calculation
    const basePacingModifier = modifier.pacingModifier || 0;
    const interactionPacingModifier = interactionRules.pacingModifier || 0;
    const effectivePacingModifier = basePacingModifier + interactionPacingModifier;
    
    if (effectivePacingModifier !== basePacingModifier) {
      section += `
=== COMBINED PACING EFFECT ===
Base trip type modifier: ${basePacingModifier > 0 ? '+' : ''}${basePacingModifier}
Archetype interaction modifier: ${interactionPacingModifier > 0 ? '+' : ''}${interactionPacingModifier}
EFFECTIVE modifier: ${effectivePacingModifier > 0 ? '+' : ''}${effectivePacingModifier}
${effectivePacingModifier < -2 ? '⚠️ VERY slow pacing required. Maximum 2-3 gentle activities per day.' : ''}
${effectivePacingModifier > 1 ? '⚡ Active pacing allowed. Can include more activities with recovery blocks.' : ''}
`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADD OXYMORON HANDLER IF APPLICABLE
  // These are "contradictory" combinations that are actually real travelers
  // ═══════════════════════════════════════════════════════════════════════════
  const oxymoronSection = buildOxymoronPromptSection(normalizedType, archetype);
  if (oxymoronSection) {
    section += oxymoronSection;
  }

  // Add upgrade note
  if (modifier.upgradeExperiences) {
    section += `
=== UPGRADE WITHIN BUDGET ===
Elevate experiences within the stated budget tier. Choose the BEST options at their price point.
`;
  }

  // Add critical compliance check based on trip type category
  // (normalizedType already defined at start of function)
  
  // Group trips
  const groupTripTypes = ['guys_trip', 'girls_trip', 'family', 'bachelorette', 'bachelor'];
  if (groupTripTypes.some(g => normalizedType.includes(g))) {
    section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: GROUP TRIP COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a GROUP trip. The itinerary MUST include:
✓ At least ONE group-focused activity (not something done alone)
✓ At least ONE evening/social option (bar, pub, dinner out, nightlife)
✓ Group-friendly dining (shareable food, not intimate couple spots)
✓ Downtime for group hanging out

⚠️ VIOLATION CHECK:
If this itinerary looks like a SOLO trip or COUPLE trip = REGENERATE
The GROUP nature MUST be OBVIOUS in activity selection and language.

Do NOT use language like "intimate", "romantic", "quiet solo moment"
DO use language like "group-friendly", "perfect for friends", "shared experience"
`;
  }

  // Celebration trips
  const celebrationTypes = ['birthday', 'anniversary', 'honeymoon', 'graduation', 'retirement'];
  if (celebrationTypes.some(c => normalizedType.includes(c))) {
    section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: CELEBRATION TRIP COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a CELEBRATION trip. The itinerary MUST include:
✓ At least ONE clear celebration moment (special dinner, toast, experience)
✓ The occasion should feel SPECIAL, not generic
✓ Something memorable that marks this milestone

⚠️ VIOLATION CHECK:
If this itinerary could be a random vacation with no occasion = REGENERATE
The CELEBRATION nature MUST be OBVIOUS.
`;
  }

  // Romance trips (may overlap with celebration)
  const romanceTypes = ['anniversary', 'honeymoon', 'babymoon'];
  if (romanceTypes.some(r => normalizedType.includes(r))) {
    section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: ROMANCE TRIP COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a ROMANTIC trip. The itinerary MUST include:
✓ Romance/couples focus visible throughout
✓ Activities designed for TWO people together
✓ At least ONE romantic highlight (sunset, special dinner, scenic moment)
✓ Pacing relaxed enough for couples time

⚠️ VIOLATION CHECK:
If this itinerary lacks romantic elements = REGENERATE
Do NOT use language like "solo", "group", "meeting people"
DO use language like "together", "romantic", "intimate", "couples"
`;
  }

  // Purpose-driven trips
  const purposeTypes = ['wellness_retreat', 'wellness', 'adventure', 'foodie', 'culinary'];
  if (purposeTypes.some(p => normalizedType.includes(p))) {
    section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: PURPOSE-DRIVEN TRIP COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a PURPOSE-DRIVEN trip (${normalizedType.replace(/_/g, ' ')}). The itinerary MUST:
✓ Make the PURPOSE dominate the itinerary
✓ Show the theme EVERY DAY, not just once
✓ Be immediately recognizable for what it is

⚠️ VIOLATION CHECK:
If someone couldn't immediately identify the trip purpose = REGENERATE
The theme must be OBVIOUS and VISIBLE throughout.
`;
  }

  // Business leisure
  if (normalizedType.includes('business') || normalizedType.includes('bleisure')) {
    section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: BUSINESS LEISURE COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a BLEISURE trip. The itinerary MUST:
✓ Keep free-time activities EFFICIENT (not full-day commitments)
✓ Include a quality dinner option for business entertaining
✓ Place activities NEAR likely business/hotel districts
✓ Allow flexibility for work schedule changes

⚠️ VIOLATION CHECK:
If activities require too much time or travel = REGENERATE
The LIMITED FREE TIME reality must be respected.
`;
  }

  // SOLO trips - comprehensive compliance check
  if (normalizedType === 'solo') {
    const calibration = soloSocialCalibration[archetype];
    const socialLevel = calibration?.socialLevel || 'medium';
    
    section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: SOLO TRIP COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a SOLO trip. Before finalizing, verify:

☐ Are ALL restaurants solo-friendly (counter seating, casual, communal)?
  - Every meal must have explicit solo-friendly note
  - No romantic fine dining, no couple-oriented venues
  
☐ Are activities appropriate for one person?
  - No couples cooking classes, romantic boat rides, tandem activities
  - Activities should feel natural alone, not awkward
  
☐ Is social calibration respected (${socialLevel.toUpperCase()})?
  ${socialLevel === 'high' ? '- Include walking tours, group activities, social opportunities' : ''}
  ${socialLevel === 'medium' ? '- Activities work alone OR could turn social' : ''}
  ${socialLevel === 'low' ? '- Self-paced activities, no forced interaction' : ''}
  ${socialLevel === 'solitude' ? '- Peaceful, quiet activities, solitude preserved' : ''}
  
☐ Is there unstructured "freedom" time?
  - Include phrases like "or skip and wander", "take as long as you want"
  - At least one "do whatever you want" block daily
  
☐ Does the itinerary CELEBRATE solo travel, not apologize for it?
  - No language suggesting they're "alone" in a sad way
  - Emphasize freedom, no compromise, their exact pace
  
☐ Are evening activities in safe, comfortable areas?
  - Well-lit, populated neighborhoods
  - Comfortable for walking alone
  
☐ Would a solo traveler look at this and think "this is FOR me"?

⚠️ VIOLATION CHECK:
- If any restaurant would feel awkward alone = REPLACE
- If any activity requires a partner = REPLACE  
- If the itinerary looks like a couples trip minus one person = REGENERATE
- If there's no freedom/flexibility language = ADD IT

The SOLO nature must be CELEBRATED and VISIBLE throughout.
Do NOT use language like "romantic", "intimate", "together"
DO use language like "your pace", "no rush", "freedom", "counter seating"
`;
  }

  return section;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTENDED HONEYMOON MATRIX - Full details for each archetype
// ═══════════════════════════════════════════════════════════════════════════
// This extends the basic honeymoon matrix with rest, romance, dining guidance
// and sample days for each archetype combination

export interface ExtendedArchetypeMatrix {
  interaction: 'override' | 'combine' | 'amplify';
  description: string;
  pacingModifier: number;
  include: string[];
  exclude: string[];
  rest: string;
  romance: string;
  diningGuidance: string;
  sampleDay: string;
}

export const extendedHoneymoonMatrix: Record<string, ExtendedArchetypeMatrix> = {
  // --- CURATORS ---
  culinary_cartographer: {
    interaction: 'combine',
    description: 'Food honeymoon. Cooking classes together. Restaurant tour. Wine tasting.',
    pacingModifier: -2,
    include: ['couples cooking class', 'food tours together', 'wine tasting', 'special restaurants'],
    exclude: ['solo food experiences', 'counter dining'],
    rest: 'Between meals. Food coma is real.',
    romance: 'Food is romantic. Cooking together. Feeding each other.',
    diningGuidance: 'Romantic tables for two. Tasting menus to share. Wine pairings.',
    sampleDay: 'Market together. Cooking class. Long lunch. Rest. Special dinner.'
  },
  art_aficionado: {
    interaction: 'combine',
    description: 'Art honeymoon. Museums together. Design hotels. Cultural romance.',
    pacingModifier: -2,
    include: ['art museums together', 'design hotels', 'cultural experiences', 'beautiful things'],
    exclude: ['rushing through museums', 'ignoring aesthetics'],
    rest: 'Beautiful rest. Design hotel suite.',
    romance: 'Beauty is romantic. Share aesthetic experiences.',
    diningGuidance: 'Beautiful restaurants. Design-forward spaces. Art-adjacent venues.',
    sampleDay: 'Museum together. Art-adjacent lunch. Hotel beauty. Gallery. Elegant dinner.'
  },
  luxury_luminary: {
    interaction: 'amplify',
    description: 'Luxury honeymoon. Five-star everything. Private experiences. Premium romance.',
    pacingModifier: -2,
    include: ['five-star everything', 'private experiences', 'VIP treatment', 'premium romance'],
    exclude: ['budget anything', 'group tours'],
    rest: 'Luxury rest. Suite. Butler. Spa.',
    romance: 'Luxury IS romance for them. Highest expression.',
    diningGuidance: 'Michelin-starred. Private dining. Chef\'s table experiences.',
    sampleDay: 'Breakfast in suite. Private tour. Fine dining lunch. Spa. Extraordinary dinner.'
  },
  // --- TRANSFORMERS ---
  eco_ethicist: {
    interaction: 'combine',
    description: 'Eco honeymoon. Sustainable resorts. Nature. Responsible romance.',
    pacingModifier: -2,
    include: ['sustainable options', 'nature', 'eco-lodges', 'responsible choices'],
    exclude: ['wasteful luxury', 'environmental harm'],
    rest: 'Nature rest. Eco-lodge hammock.',
    romance: 'Shared values are romantic. Nature is romantic.',
    diningGuidance: 'Farm-to-table. Sustainable seafood. Local and organic.',
    sampleDay: 'Nature walk together. Eco-lodge lunch. Rest. Conservation activity. Farm dinner.'
  },
  gap_year_graduate: {
    interaction: 'combine',
    description: 'Budget honeymoon. Romantic doesn\'t require luxury. Meaningful over expensive.',
    pacingModifier: -2,
    include: ['budget romance', 'free romantic activities', 'one splurge', 'meaningful over expensive'],
    exclude: ['expensive pressure', 'luxury expectations'],
    rest: 'Hostel private room nap. Beach rest. Free.',
    romance: 'Love doesn\'t cost money. Creativity over budget.',
    diningGuidance: 'Street food romance. Picnics. One special splurge dinner.',
    sampleDay: 'Free beach morning. Cheap romantic lunch. Nap. Sunset. One nice dinner.'
  },
  midlife_explorer: {
    interaction: 'combine',
    description: 'Mature honeymoon. Quality over flash. Meaningful, not showy.',
    pacingModifier: -2,
    include: ['quality experiences', 'meaningful moments', 'substance over style'],
    exclude: ['superficial', 'trying too hard'],
    rest: 'Built-in through pace.',
    romance: 'Mature romance. Depth over display.',
    diningGuidance: 'Quality restaurants. Meaningful atmosphere over hype.',
    sampleDay: 'Leisurely start. Meaningful experience. Quality lunch. Rest. Thoughtful dinner.'
  },
  sabbatical_scholar: {
    interaction: 'combine',
    description: 'Learning honeymoon. Courses together. Intellectual romance.',
    pacingModifier: -2,
    include: ['learning together', 'courses', 'intellectual connection', 'curious romance'],
    exclude: ['anti-intellectual venues', 'mindless activities'],
    rest: 'Reading together. Processing.',
    romance: 'Intellectual connection is romantic. Learn together.',
    diningGuidance: 'Bookshop cafes. Literary venues. Discussion-friendly spots.',
    sampleDay: 'Workshop together. Thoughtful lunch. Reading rest. Cultural site. Dinner discussion.'
  },
  healing_journeyer: {
    interaction: 'combine',
    description: 'Gentle honeymoon. Healing together. Restorative. Peaceful bond.',
    pacingModifier: -3,
    include: ['gentle activities', 'healing', 'nature', 'peaceful togetherness'],
    exclude: ['intensity', 'stress', 'packed schedules'],
    rest: 'Maximum. Healing is the point.',
    romance: 'Gentle love. Healing together.',
    diningGuidance: 'Nourishing. Comfort food. No pressure venues.',
    sampleDay: 'Gentle morning. Easy activity. Nourishing lunch. Long rest. Peaceful dinner.'
  },
  retirement_ranger: {
    interaction: 'combine',
    description: 'Later-life honeymoon. Comfortable. Quality. No rushing. Celebrating partnership.',
    pacingModifier: -2,
    include: ['comfort', 'quality', 'no rushing', 'celebrating years together'],
    exclude: ['physical strain', 'rushing', 'uncomfortable'],
    rest: 'Built-in through pace.',
    romance: 'Mature romance. Comfort is romantic.',
    diningGuidance: 'Early dinner available. Comfortable seating. Quality over trendy.',
    sampleDay: 'Late breakfast. Comfortable activity. Nice lunch. Rest. Early lovely dinner.'
  },
  balanced_story_collector: {
    interaction: 'combine',
    description: 'Classic honeymoon. Mix of romance, sightseeing, relaxation. Balanced newlywed trip.',
    pacingModifier: -2,
    include: ['balance', 'mix of activities', 'romantic moments', 'some sightseeing', 'relaxation'],
    exclude: ['extremes', 'imbalance'],
    rest: 'Built-in through balance.',
    romance: 'Classic romance. Sunset. Special dinner. Beautiful moments.',
    diningGuidance: 'Mix of casual and special. Balance of local and fine.',
    sampleDay: 'Leisurely start. One activity. Romantic lunch. Rest/pool. Sunset. Special dinner.'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SYNTHESIS FUNCTION - Combine Trip Type + Archetype + Traits
// ═══════════════════════════════════════════════════════════════════════════
// This is the master function that produces comprehensive guidance

export interface TraitScores {
  pace: number;
  budget: number;
  adventure: number;
  comfort: number;
  social: number;
  planning: number;
}

export interface SynthesizedGuidance {
  interactionType: 'override' | 'combine' | 'amplify' | 'neutral';
  effectivePace: number;
  promptSection: string;
  validation: string;
}

/**
 * Synthesize trip type, archetype, and traits into comprehensive generation guidance
 */
export function synthesizeTripTypeAndArchetype(
  tripType: string,
  archetype: string,
  traits: TraitScores
): SynthesizedGuidance {
  const normalizedTripType = tripType?.toLowerCase().replace(/[\s-]+/g, '_') || 'none';
  const normalizedArchetype = archetype?.toLowerCase().replace(/[\s-]+/g, '_') || '';
  
  // Get matrix interaction rules
  const matrix = getArchetypeInteraction(normalizedTripType, normalizedArchetype);
  
  // Get oxymoron handler if applicable
  const oxymoronHandler = getOxymoronHandler(normalizedTripType, normalizedArchetype);
  
  // Get extended honeymoon data if applicable
  const extendedHoneymoon = normalizedTripType === 'honeymoon' 
    ? extendedHoneymoonMatrix[normalizedArchetype] 
    : null;
  
  // Get solo social calibration if applicable
  const soloCalibration = normalizedTripType === 'solo' 
    ? soloSocialCalibration[normalizedArchetype] 
    : null;
  
  // Calculate effective pacing
  const basePace = traits?.pace ?? 5;
  const tripModifier = matrix?.pacingModifier || 0;
  const effectivePace = Math.max(1, Math.min(10, basePace + tripModifier));
  
  // Get interaction type
  const interactionType = matrix?.interaction || 'combine';
  
  // Get pacing rules based on effective pace
  let pacingRules = '';
  if (effectivePace <= 3) {
    pacingRules = 'VERY SLOW pacing. Max 2-3 gentle activities per day. Long rest blocks. No rushing.';
  } else if (effectivePace <= 5) {
    pacingRules = 'MODERATE pacing. 3-4 activities per day. Include rest breaks. Buffer time between.';
  } else if (effectivePace <= 7) {
    pacingRules = 'ACTIVE pacing. 4-5 activities per day. Efficient but not exhausting.';
  } else {
    pacingRules = 'FULL pacing. 5-6 activities per day. Maximize time. Include recovery blocks.';
  }
  
  // Build the comprehensive prompt section
  let promptSection = `
═══════════════════════════════════════════════════════════════════════════
TRIP TYPE × ARCHETYPE SYNTHESIS
═══════════════════════════════════════════════════════════════════════════

Trip Type: ${normalizedTripType.replace(/_/g, ' ').toUpperCase()}
Archetype: ${normalizedArchetype.replace(/_/g, ' ')}
Interaction: ${interactionType.toUpperCase()}

${matrix?.description || 'Standard combination - apply archetype style to trip type requirements.'}
`;

  // Add oxymoron handling if applicable
  if (oxymoronHandler) {
    promptSection += `

═══════════════════════════════════════════════════════════════════════════
⚠️ SPECIAL COMBINATION DETECTED
═══════════════════════════════════════════════════════════════════════════

This combination may SEEM contradictory but represents a REAL traveler type.

COMMON MISUNDERSTANDING: ${oxymoronHandler.commonMisunderstanding}
ACTUAL NEED: ${oxymoronHandler.actualNeed}
TRANSLATION PRINCIPLE: ${oxymoronHandler.translationPrinciple}

WHAT THEY WANT:
${oxymoronHandler.concreteExamples.slice(0, 5).map(ex => `✓ ${ex}`).join('\n')}

MISTAKES TO AVOID:
${oxymoronHandler.avoidMistakes.slice(0, 4).map(m => `✗ ${m}`).join('\n')}
`;
  }

  // Add solo social calibration if applicable
  if (soloCalibration) {
    promptSection += `

═══════════════════════════════════════════════════════════════════════════
SOLO SOCIAL CALIBRATION: ${soloCalibration.socialLevel.toUpperCase()}
═══════════════════════════════════════════════════════════════════════════

${soloCalibration.description}

INCLUDE:
${soloCalibration.include.slice(0, 5).map(i => `✓ ${i}`).join('\n')}

AVOID:
${soloCalibration.avoid.slice(0, 3).map(a => `✗ ${a}`).join('\n')}
`;
  }

  // Add extended honeymoon details if applicable
  if (extendedHoneymoon) {
    promptSection += `

═══════════════════════════════════════════════════════════════════════════
HONEYMOON DETAILS FOR ${normalizedArchetype.replace(/_/g, ' ').toUpperCase()}
═══════════════════════════════════════════════════════════════════════════

${extendedHoneymoon.description}

REST REQUIREMENTS: ${extendedHoneymoon.rest}
ROMANCE GUIDANCE: ${extendedHoneymoon.romance}
DINING: ${extendedHoneymoon.diningGuidance}
SAMPLE DAY: ${extendedHoneymoon.sampleDay}
`;
  }

  // Add priority shifts and constraints
  if (matrix?.priorityShift && matrix.priorityShift.length > 0) {
    promptSection += `

=== PRIORITIZE (move to top of experience list) ===
${matrix.priorityShift.map(p => `• ${p}`).join('\n')}
`;
  }

  if (matrix?.deprioritize && matrix.deprioritize.length > 0) {
    promptSection += `
=== DEPRIORITIZE (move down or remove) ===
${matrix.deprioritize.map(d => `• ${d}`).join('\n')}
`;
  }

  if (matrix?.hardConstraints && matrix.hardConstraints.length > 0) {
    promptSection += `
=== HARD CONSTRAINTS (cannot be violated) ===
${matrix.hardConstraints.map(c => `🚫 ${c}`).join('\n')}
`;
  }

  // Add effective pacing
  promptSection += `

=== EFFECTIVE PACING ===
Base pace: ${basePace}
Trip type modifier: ${tripModifier > 0 ? '+' : ''}${tripModifier}
Effective pace: ${effectivePace}

${pacingRules}

═══════════════════════════════════════════════════════════════════════════
`;

  // Build validation checklist
  const validation = `
SYNTHESIS VALIDATION - Before finalizing, verify:

☐ Does the trip type purpose show clearly? (${normalizedTripType.replace(/_/g, ' ')})
☐ Is the archetype style expressed? (${normalizedArchetype.replace(/_/g, ' ')})
${matrix?.priorityShift?.length ? '☐ Are PRIORITIZE items present?' : ''}
${matrix?.deprioritize?.length ? '☐ Are DEPRIORITIZE items absent?' : ''}
☐ Is pacing correct for effective pace of ${effectivePace}?
${soloCalibration ? `☐ Is social calibration at '${soloCalibration.socialLevel}' level?` : ''}
${oxymoronHandler ? `☐ Is the special combination handled correctly?` : ''}
☐ Would THIS specific traveler be excited by this itinerary?
`;

  return {
    interactionType,
    effectivePace,
    promptSection,
    validation
  };
}

/**
 * Get extended honeymoon matrix for a specific archetype
 */
export function getExtendedHoneymoonGuidance(archetype: string): ExtendedArchetypeMatrix | null {
  const normalizedArchetype = archetype?.toLowerCase().replace(/[\s-]+/g, '_') || '';
  return extendedHoneymoonMatrix[normalizedArchetype] || null;
}
