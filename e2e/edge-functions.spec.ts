/**
 * Edge Function Health E2E Tests
 * 
 * Tests that critical edge functions respond correctly:
 * - CORS preflight handling
 * - Valid response structures
 * - Error handling for invalid requests
 */

import { test, expect } from '@playwright/test';

// Get Supabase URL from environment or use default pattern
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jsxplunjjvxuejeouwob.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

test.describe('Edge Functions - CORS Preflight', () => {
  const functionsToTest = [
    'generate-itinerary',
    'analyze-preferences',
    'parse-travel-story',
    'calculate-travel-dna',
  ];

  for (const functionName of functionsToTest) {
    test(`${functionName} returns correct CORS headers on OPTIONS`, async ({ request }) => {
      const response = await request.fetch(`${FUNCTIONS_URL}/${functionName}`, {
        method: 'OPTIONS',
      });
      
      // OPTIONS should return 200 or 204
      expect([200, 204]).toContain(response.status());
      
      // Check CORS headers
      const headers = response.headers();
      expect(headers['access-control-allow-origin']).toBe('*');
      expect(headers['access-control-allow-headers']).toBeTruthy();
    });
  }
});

test.describe('Edge Functions - Auth Validation', () => {
  test('generate-itinerary returns 401 without auth token', async ({ request }) => {
    const response = await request.post(`${FUNCTIONS_URL}/generate-itinerary`, {
      data: { tripId: 'test-trip-id' },
    });
    
    // Should return 401 Unauthorized, not 500
    expect([401, 403]).toContain(response.status());
  });

  test('spend-credits returns 401 without auth token', async ({ request }) => {
    const response = await request.post(`${FUNCTIONS_URL}/spend-credits`, {
      data: { amount: 1, operation: 'test' },
    });
    
    expect([401, 403]).toContain(response.status());
  });

  test('analyze-preferences returns 401 without auth token', async ({ request }) => {
    const response = await request.post(`${FUNCTIONS_URL}/analyze-preferences`, {
      data: { preferences: {} },
    });
    
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Edge Functions - Request Validation', () => {
  test('generate-itinerary validates required fields', async ({ request }) => {
    const response = await request.post(`${FUNCTIONS_URL}/generate-itinerary`, {
      data: {}, // Missing required tripId
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });
    
    // Should return 400 Bad Request or 401 Unauthorized
    expect([400, 401, 403]).toContain(response.status());
  });

  test('parse-travel-story validates story content', async ({ request }) => {
    const response = await request.post(`${FUNCTIONS_URL}/parse-travel-story`, {
      data: {}, // Missing required story
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });
    
    expect([400, 401, 403]).toContain(response.status());
  });
});

test.describe('Edge Functions - Response Format', () => {
  test('CORS headers are present on error responses', async ({ request }) => {
    const response = await request.post(`${FUNCTIONS_URL}/generate-itinerary`, {
      data: { tripId: 'invalid' },
    });
    
    // Even error responses should have CORS headers
    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBe('*');
  });

  test('error responses are JSON formatted', async ({ request }) => {
    const response = await request.post(`${FUNCTIONS_URL}/generate-itinerary`, {
      data: {},
    });
    
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
    
    // Response body should be valid JSON
    const body = await response.json().catch(() => null);
    expect(body).not.toBeNull();
  });
});

test.describe('Edge Functions - Endpoint Availability', () => {
  const endpoints = [
    { name: 'generate-itinerary', method: 'POST' },
    { name: 'analyze-preferences', method: 'POST' },
    { name: 'parse-travel-story', method: 'POST' },
    { name: 'calculate-travel-dna', method: 'POST' },
    { name: 'get-destination-guide', method: 'POST' },
  ];

  for (const endpoint of endpoints) {
    test(`${endpoint.name} endpoint is reachable`, async ({ request }) => {
      const response = await request.fetch(`${FUNCTIONS_URL}/${endpoint.name}`, {
        method: 'OPTIONS',
      });
      
      // Should not return 404
      expect(response.status()).not.toBe(404);
    });
  }
});

test.describe('Edge Functions - Hotels & Flights', () => {
  test('hotels endpoint responds to OPTIONS', async ({ request }) => {
    const response = await request.fetch(`${FUNCTIONS_URL}/hotels`, {
      method: 'OPTIONS',
    });
    
    expect([200, 204]).toContain(response.status());
  });

  test('flights endpoint responds to OPTIONS', async ({ request }) => {
    const response = await request.fetch(`${FUNCTIONS_URL}/flights`, {
      method: 'OPTIONS',
    });
    
    expect([200, 204]).toContain(response.status());
  });
});

test.describe('Edge Functions - Rate Limiting', () => {
  test('endpoints handle rapid requests gracefully', async ({ request }) => {
    // Send 5 rapid requests
    const requests = Array(5).fill(null).map(() =>
      request.fetch(`${FUNCTIONS_URL}/parse-travel-story`, {
        method: 'OPTIONS',
      })
    );
    
    const responses = await Promise.all(requests);
    
    // All should succeed (no 500 errors from rate limiting crash)
    for (const response of responses) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});
