/**
 * Format price with currency
 */
export const formatPrice = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format price with decimal places
 */
export const formatPriceDetailed = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Calculate total price from items
 */
export const calculateTotalPrice = (items: { price?: number }[]): number => {
  return items.reduce((total, item) => total + (item.price || 0), 0);
};

/**
 * Get price tier label
 */
export const getPriceTierLabel = (tier: string): string => {
  const labels: Record<string, string> = {
    budget: '$',
    moderate: '$$',
    premium: '$$$',
    luxury: '$$$$'
  };
  return labels[tier.toLowerCase()] || '$$';
};

/**
 * Get price tier description
 */
export const getPriceTierDescription = (tier: string): string => {
  const descriptions: Record<string, string> = {
    budget: 'Budget-friendly options',
    moderate: 'Mid-range comfort',
    premium: 'Premium experiences',
    luxury: 'Luxury accommodations'
  };
  return descriptions[tier.toLowerCase()] || 'Standard options';
};

/**
 * Validate booking data
 */
export const validateBookingData = (data: {
  destination?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!data.destination) {
    errors.push('Destination is required');
  }
  
  if (!data.startDate) {
    errors.push('Start date is required');
  }
  
  if (!data.endDate) {
    errors.push('End date is required');
  }
  
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end <= start) {
      errors.push('End date must be after start date');
    }
  }
  
  if (!data.travelers || data.travelers < 1) {
    errors.push('At least one traveler is required');
  }
  
  if (data.travelers && data.travelers > 20) {
    errors.push('Maximum 20 travelers allowed');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Calculate trip cost estimate
 */
export const calculateTripEstimate = (params: {
  nights: number;
  travelers: number;
  hotelPerNight?: number;
  flightPerPerson?: number;
  dailyActivities?: number;
}): {
  hotel: number;
  flights: number;
  activities: number;
  total: number;
} => {
  const { 
    nights, 
    travelers, 
    hotelPerNight = 200, 
    flightPerPerson = 500, 
    dailyActivities = 100 
  } = params;
  
  const hotel = hotelPerNight * nights;
  const flights = flightPerPerson * travelers;
  const activities = dailyActivities * (nights + 1);
  const total = hotel + flights + activities;
  
  return { hotel, flights, activities, total };
};
