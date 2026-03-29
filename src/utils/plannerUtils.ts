/**
 * Format duration in minutes to human-readable string
 */
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

/**
 * Parse duration string to minutes
 */
export const parseDuration = (duration: string): number => {
  const hourMatch = duration.match(/(\d+)\s*h/);
  const minMatch = duration.match(/(\d+)\s*m/);
  
  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;
  
  return hours * 60 + minutes;
};

/**
 * Get activity icon name (Lucide icon) based on type
 */
export const getActivityIconName = (type: string): string => {
  const icons: Record<string, string> = {
    activity: 'Target',
    attraction: 'Landmark',
    restaurant: 'UtensilsCrossed',
    food: 'UtensilsCrossed',
    meal: 'UtensilsCrossed',
    hotel: 'Building2',
    accommodation: 'Building2',
    transport: 'Plane',
    transit: 'Bus',
    break: 'Coffee',
    rest: 'Moon',
    nature: 'Leaf',
    adventure: 'Mountain',
    culture: 'Palette',
    wellness: 'Heart',
    nightlife: 'Moon',
    shopping: 'ShoppingBag',
    default: 'MapPin'
  };
  return icons[(type || 'activity').toLowerCase()] || icons.default;
};

/**
 * Calculate total budget for a day's activities
 */
export const calculateDayBudget = (activities: { price?: number }[]): number => {
  return activities.reduce((total, activity) => total + (activity.price || 0), 0);
};

/**
 * Get activity color based on category
 */
export const getActivityColor = (category: string): string => {
  const colors: Record<string, string> = {
    culture: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    food: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    nature: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    adventure: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    wellness: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    nightlife: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    transit: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    break: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    default: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300'
  };
  return colors[(category || 'activity').toLowerCase()] || colors.default;
};

/**
 * Generate time slots for day planning
 */
export const generateTimeSlots = (
  startHour = 8,
  endHour = 22,
  intervalMinutes = 30
): string[] => {
  const slots: string[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let min = 0; min < 60; min += intervalMinutes) {
      if (hour === endHour && min > 0) break;
      slots.push(
        `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      );
    }
  }
  return slots;
};

/**
 * Validate trip dates
 */
export const validateTripDates = (
  startDate: string,
  endDate: string
): { valid: boolean; error?: string } => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start < today) {
    return { valid: false, error: 'Start date cannot be in the past' };
  }
  
  if (end <= start) {
    return { valid: false, error: 'End date must be after start date' };
  }
  
  const maxDays = 30;
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > maxDays) {
    return { valid: false, error: `Trip cannot exceed ${maxDays} days` };
  }
  
  return { valid: true };
};
