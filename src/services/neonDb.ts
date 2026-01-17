import { supabase } from '@/integrations/supabase/client';

const FUNCTION_NAME = 'neon-db';

interface NeonResponse<T = unknown> {
  data: T | null;
  error: string | null;
}

// Generic fetch helper for Neon DB edge function
async function callNeonDb<T = unknown>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
    params?: Record<string, string>;
  } = {}
): Promise<NeonResponse<T>> {
  const { method = 'GET', body, params } = options;
  
  // Build query string
  const queryString = params 
    ? '?' + new URLSearchParams(params).toString()
    : '';
  
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    method,
    body: body ? { ...body, _path: path + queryString } : { _path: path + queryString },
  });

  if (error) {
    console.error('[NeonDB] Error:', error);
    return { data: null, error: error.message };
  }

  return data as NeonResponse<T>;
}

// Alternative: Direct HTTP call to edge function
async function callNeonDbDirect<T = unknown>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
    params?: Record<string, string>;
  } = {}
): Promise<NeonResponse<T>> {
  const { method = 'GET', body, params } = options;
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  // Build query string
  const queryString = params 
    ? '?' + new URLSearchParams(params).toString()
    : '';
  
  const url = `${supabaseUrl}/functions/v1/${FUNCTION_NAME}${path}${queryString}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json();
    return data as NeonResponse<T>;
  } catch (error) {
    console.error('[NeonDB] Direct call error:', error);
    return { data: null, error: (error as Error).message };
  }
}

// Profiles API
export interface Profile {
  user_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  home_airport: string | null;
  created_at: string;
  updated_at: string;
}

export const profilesApi = {
  get: async (userId: string) => {
    return callNeonDbDirect<Profile[]>('/profiles', {
      method: 'GET',
      params: { userId },
    });
  },
  
  update: async (userId: string, profile: { email?: string; name?: string; avatarUrl?: string; homeAirport?: string }) => {
    return callNeonDbDirect<Profile[]>('/profiles', {
      method: 'PUT',
      body: { userId, ...profile },
    });
  },
};

// Preferences API
export const preferencesApi = {
  get: async (userId: string) => {
    return callNeonDbDirect('/preferences', {
      method: 'GET',
      params: { userId },
    });
  },
  
  update: async (userId: string, preferences: Record<string, unknown>) => {
    return callNeonDbDirect('/preferences', {
      method: 'PUT',
      body: { userId, preferences },
    });
  },
};

// Trips API
export interface Trip {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  status: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export const tripsApi = {
  list: async (userId: string) => {
    return callNeonDbDirect<Trip[]>('/trips', {
      method: 'GET',
      params: { userId },
    });
  },
  
  get: async (tripId: string) => {
    return callNeonDbDirect<Trip[]>(`/trips/${tripId}`, {
      method: 'GET',
    });
  },
  
  create: async (userId: string, tripData: Partial<Trip>) => {
    return callNeonDbDirect<Trip[]>('/trips', {
      method: 'POST',
      body: { userId, ...tripData },
    });
  },
  
  update: async (tripId: string, tripData: Partial<Trip>) => {
    return callNeonDbDirect<Trip[]>(`/trips/${tripId}`, {
      method: 'PUT',
      body: tripData,
    });
  },
  
  delete: async (tripId: string) => {
    return callNeonDbDirect<{ id: string }[]>(`/trips/${tripId}`, {
      method: 'DELETE',
    });
  },
};

// Health check
export const healthCheck = async () => {
  return callNeonDbDirect<{ status: string; database: string; time: string }>('/health');
};

// Generic query (use with caution)
export const queryTable = async (
  table: string,
  operation: 'select',
  filters?: Record<string, unknown>
) => {
  return callNeonDbDirect('/query', {
    method: 'POST',
    body: { table, operation, filters },
  });
};

export default {
  profiles: profilesApi,
  preferences: preferencesApi,
  trips: tripsApi,
  health: healthCheck,
  query: queryTable,
};
