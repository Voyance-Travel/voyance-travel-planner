/**
 * Voyance Contact Configuration
 * Centralized contact information for the application
 */

export const CONTACT_CONFIG = {
  // Primary support email for general inquiries and help
  SUPPORT_EMAIL: 'contact@travelwithvoyance.com',
  
  // Careers email for job applications
  CAREERS_EMAIL: 'contact@travelwithvoyance.com',
  
  // Email for booking-related inquiries
  BOOKINGS_EMAIL: 'contact@travelwithvoyance.com',
  
  // Social media links
  SOCIAL: {
    FACEBOOK: 'https://facebook.com/voyancetravel',
    INSTAGRAM: 'https://instagram.com/voyancetravel',
    X: 'https://x.com/voyancetravel',
    PINTEREST: 'https://pinterest.com/voyancetravel',
  },
  
  // Response time expectations
  RESPONSE_TIME: '24-48 hours',
} as const;

export default CONTACT_CONFIG;
