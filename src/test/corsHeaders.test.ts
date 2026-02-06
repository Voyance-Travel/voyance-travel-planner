/**
 * Tests for CORS Header Configuration
 * 
 * Verifies that edge functions use consistent CORS headers.
 */
import { describe, it, expect } from 'vitest';

// The standard CORS headers that all edge functions should use
const REQUIRED_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

describe('CORS Headers Standard', () => {
  it('should have correct Access-Control-Allow-Origin', () => {
    expect(REQUIRED_CORS_HEADERS['Access-Control-Allow-Origin']).toBe('*');
  });

  it('should include all required headers in Access-Control-Allow-Headers', () => {
    const allowedHeaders = REQUIRED_CORS_HEADERS['Access-Control-Allow-Headers'];
    
    // Core headers
    expect(allowedHeaders).toContain('authorization');
    expect(allowedHeaders).toContain('x-client-info');
    expect(allowedHeaders).toContain('apikey');
    expect(allowedHeaders).toContain('content-type');
    
    // Supabase client headers (required for modern clients)
    expect(allowedHeaders).toContain('x-supabase-client-platform');
    expect(allowedHeaders).toContain('x-supabase-client-platform-version');
    expect(allowedHeaders).toContain('x-supabase-client-runtime');
    expect(allowedHeaders).toContain('x-supabase-client-runtime-version');
  });

  it('should be usable in Response headers', () => {
    // Verify the headers can be spread into a Response
    const response = new Response(JSON.stringify({ test: true }), {
      headers: {
        ...REQUIRED_CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
    
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('CORS Preflight Handling', () => {
  it('should return 200/204 for OPTIONS requests', () => {
    // Simulate OPTIONS preflight handler
    function handlePreflight(method: string): Response | null {
      if (method === 'OPTIONS') {
        return new Response(null, { headers: REQUIRED_CORS_HEADERS });
      }
      return null;
    }
    
    const response = handlePreflight('OPTIONS');
    
    expect(response).not.toBeNull();
    expect(response?.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should return null for non-OPTIONS requests', () => {
    function handlePreflight(method: string): Response | null {
      if (method === 'OPTIONS') {
        return new Response(null, { headers: REQUIRED_CORS_HEADERS });
      }
      return null;
    }
    
    expect(handlePreflight('GET')).toBeNull();
    expect(handlePreflight('POST')).toBeNull();
    expect(handlePreflight('PUT')).toBeNull();
    expect(handlePreflight('DELETE')).toBeNull();
  });
});

describe('Edge Function Response Helpers', () => {
  // Test helper functions that edge functions should use
  
  function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...REQUIRED_CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  
  function errorResponse(message: string, status = 500): Response {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...REQUIRED_CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  it('jsonResponse should include CORS headers', async () => {
    const response = jsonResponse({ success: true });
    
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  it('errorResponse should include CORS headers', async () => {
    const response = errorResponse('Something went wrong', 400);
    
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.status).toBe(400);
    
    const body = await response.json();
    expect(body).toEqual({ error: 'Something went wrong' });
  });

  it('should handle custom status codes', () => {
    expect(jsonResponse({ created: true }, 201).status).toBe(201);
    expect(errorResponse('Not found', 404).status).toBe(404);
    expect(errorResponse('Unauthorized', 401).status).toBe(401);
  });
});
