import type { Itinerary, ItineraryDay, ItineraryItem } from '@/lib/trips';

/**
 * Generate a sample itinerary for demonstration
 */
export function generateSampleItinerary(
  destination: string,
  startDate: string,
  days: number
): Itinerary {
  const itineraryDays: ItineraryDay[] = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    itineraryDays.push(generateSampleDay(i + 1, date.toISOString().split('T')[0], destination));
  }
  
  return {
    id: `itinerary-${Date.now()}`,
    tripId: `trip-${Date.now()}`,
    summary: `Experience the best of ${destination} over ${days} days. This itinerary balances cultural immersion, local cuisine, and memorable experiences tailored to your preferences.`,
    days: itineraryDays,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a sample day
 */
function generateSampleDay(dayNumber: number, date: string, destination: string): ItineraryDay {
  const activities = getSampleActivitiesForDay(dayNumber, destination);
  
  const headlines: Record<number, string> = {
    1: 'Arrival & First Impressions',
    2: 'Cultural Immersion',
    3: 'Hidden Gems',
    4: 'Local Experiences',
    5: 'Adventure Day',
    6: 'Culinary Journey',
    7: 'Relaxation & Reflection',
  };
  
  const rationales: Record<number, string[]> = {
    1: ['Easy start to adjust to the destination', 'Key landmarks for orientation'],
    2: ['Deep dive into local culture', 'Balanced pacing with rest breaks'],
    3: ['Off-the-beaten-path discoveries', 'Authentic local interactions'],
    4: ['Hands-on experiences', 'Memorable moments over checkboxes'],
    5: ['Active exploration', 'Natural beauty and outdoor activities'],
    6: ['Food-focused itinerary', 'Local markets and cooking experiences'],
    7: ['Slower pace for departure day', 'Final memorable experiences'],
  };
  
  const dayIndex = ((dayNumber - 1) % 7) + 1;
  
  return {
    id: `day-${dayNumber}`,
    dayNumber,
    date,
    headline: headlines[dayIndex] || `Day ${dayNumber} in ${destination}`,
    rationale: rationales[dayIndex] || ['Curated based on your preferences'],
    items: activities,
  };
}

/**
 * Get sample activities for a specific day
 */
function getSampleActivitiesForDay(dayNumber: number, destination: string): ItineraryItem[] {
  const baseActivities: ItineraryItem[] = [
    {
      id: `activity-${dayNumber}-1`,
      type: 'FOOD',
      title: 'Breakfast at Local Café',
      neighborhood: 'City Center',
      startTime: '08:00',
      endTime: '09:00',
      notes: 'Try the local specialty',
      rationale: ['Highly rated by locals', 'Authentic experience'],
    },
    {
      id: `activity-${dayNumber}-2`,
      type: 'ACTIVITY',
      title: dayNumber === 1 ? 'Neighborhood Walking Tour' : 'Morning Exploration',
      neighborhood: 'Historic District',
      startTime: '09:30',
      endTime: '12:00',
      notes: 'Comfortable walking shoes recommended',
      rationale: ['Best visited in morning light', 'Fewer crowds early'],
    },
    {
      id: `activity-${dayNumber}-3`,
      type: 'FOOD',
      title: 'Lunch at Hidden Gem Restaurant',
      neighborhood: 'Local Quarter',
      startTime: '12:30',
      endTime: '14:00',
      notes: 'Reservation recommended',
      rationale: ['Award-winning cuisine', 'Off-tourist-path location'],
    },
    {
      id: `activity-${dayNumber}-4`,
      type: 'BREAK',
      title: 'Afternoon Rest',
      startTime: '14:00',
      endTime: '15:30',
      notes: 'Return to hotel or find a peaceful café',
      rationale: ['Prevents travel fatigue', 'Recharge for evening activities'],
    },
    {
      id: `activity-${dayNumber}-5`,
      type: 'ACTIVITY',
      title: getAfternoonActivity(dayNumber),
      neighborhood: 'Cultural District',
      startTime: '16:00',
      endTime: '18:00',
      notes: 'Peak hours for this experience',
      rationale: ['Optimal timing', 'Matches your interests'],
    },
    {
      id: `activity-${dayNumber}-6`,
      type: 'FOOD',
      title: 'Dinner Experience',
      neighborhood: 'Dining District',
      startTime: '19:00',
      endTime: '21:00',
      notes: 'Evening atmosphere at its best',
      rationale: ['Curated for your preferences', 'Authentic local dining'],
    },
  ];
  
  return baseActivities;
}

/**
 * Get afternoon activity based on day number
 */
function getAfternoonActivity(dayNumber: number): string {
  const activities = [
    'Museum Visit',
    'Market Exploration',
    'Garden Stroll',
    'Cultural Workshop',
    'Scenic Viewpoint',
    'Local Art Gallery',
    'Neighborhood Discovery',
  ];
  return activities[(dayNumber - 1) % activities.length];
}

/**
 * Get sample trip data for demonstration
 */
export function getSampleTrip() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 30); // 30 days from now
  
  const destination = 'Kyoto, Japan';
  const days = 5;
  
  return {
    id: 'sample-trip-1',
    destination,
    destinationId: 'kyoto',
    startDate: startDate.toISOString().split('T')[0],
    endDate: new Date(startDate.getTime() + (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    travelers: 2,
    itinerary: generateSampleItinerary(destination, startDate.toISOString().split('T')[0], days),
  };
}
