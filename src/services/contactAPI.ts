/**
 * Voyance Contact API
 * 
 * Contact form endpoints:
 * - POST /api/contact-us - Simple contact form
 * - POST /api/contact - Detailed contact form with types
 */

import { z } from 'zod';
import { CONTACT_CONFIG } from '@/config/contact';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types & Validation Schemas
// ============================================================================

// Simple contact form (contactUs)
export const SimpleContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().trim().email('Invalid email address'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(5000, 'Message is too long'),
});

export type SimpleContactInput = z.infer<typeof SimpleContactSchema>;

// Detailed contact form
export const ContactFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().trim().email('Invalid email address'),
  subject: z.string().trim().min(1, 'Subject is required').max(200, 'Subject is too long'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(5000, 'Message is too long'),
  type: z.enum(['general', 'support', 'feedback', 'bug_report', 'feature_request']).default('general'),
});

export type ContactFormInput = z.infer<typeof ContactFormSchema>;

export interface ContactResponse {
  success: boolean;
  message?: string;
  messageId?: string;
  error?: string;
  details?: string;
}

// ============================================================================
// Contact API
// ============================================================================

/**
 * Submit simple contact form
 */
export async function submitSimpleContact(data: SimpleContactInput): Promise<ContactResponse> {
  try {
    // Validate input
    const validated = SimpleContactSchema.parse(data);
    
    const response = await fetch(`${BACKEND_URL}/api/contact-us`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validated),
    });
    
    return response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.errors.map(e => e.message).join(', '),
      };
    }
    
    console.error('[ContactAPI] Submit simple contact error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit contact form',
    };
  }
}

/**
 * Submit detailed contact form
 */
export async function submitContactForm(data: ContactFormInput): Promise<ContactResponse> {
  try {
    // Validate input
    const validated = ContactFormSchema.parse(data);
    
    const response = await fetch(`${BACKEND_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validated),
    });
    
    return response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.errors.map(e => e.message).join(', '),
      };
    }
    
    console.error('[ContactAPI] Submit contact form error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit contact form',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useSubmitSimpleContact() {
  return useMutation({
    mutationFn: (data: SimpleContactInput) => submitSimpleContact(data),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Message sent successfully!');
      } else {
        toast.error(data.error || 'Failed to send message');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    },
  });
}

export function useSubmitContactForm() {
  return useMutation({
    mutationFn: (data: ContactFormInput) => submitContactForm(data),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Message sent successfully!');
      } else {
        toast.error(data.error || 'Failed to send message');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const contactAPI = {
  submitSimpleContact,
  submitContactForm,
  
  // Validation schemas for use in forms
  SimpleContactSchema,
  ContactFormSchema,
};

export default contactAPI;
