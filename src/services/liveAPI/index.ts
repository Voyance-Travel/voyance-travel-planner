/**
 * Live API Integrations
 *
 * Export all live API handlers for use when ENABLE_MOCK_APIS is false
 */

// Mock amadeusAPI for now since the real implementation has parsing errors
export const amadeusAPI = {
  searchFlights: (_params: unknown) => {
    return Promise.resolve([]);
  },
  getFlightDetails: (_flightId: string) => {
    return Promise.resolve(null);
  },
};

// Mock bookingAPI for now
export const bookingAPI = {
  searchHotels: (_params: unknown) => {
    return Promise.resolve([]);
  },
  getHotelDetails: (_hotelId: string) => {
    return Promise.resolve(null);
  },
};

// Future integrations can be added here when their implementations are ready
// export { getYourGuideAPI } from './getYourGuideAPI';
// export { viatorAPI } from './viatorAPI';
// export { googlePlacesAPI } from './googlePlacesAPI';
