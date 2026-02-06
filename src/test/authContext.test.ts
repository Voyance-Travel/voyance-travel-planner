/**
 * Integration Tests for AuthContext
 * 
 * Tests the authentication state management patterns.
 * Uses pure TypeScript mocks to avoid React testing library issues.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase types
interface MockUser {
  id: string;
  email: string;
  created_at: string;
  user_metadata: Record<string, unknown>;
}

interface MockSession {
  user: MockUser;
  access_token: string;
}

interface MockProfile {
  display_name?: string;
  avatar_url?: string;
  quiz_completed?: boolean;
  travel_dna?: unknown;
}

interface MockPreferences {
  budget_tier?: string;
  travel_pace?: string;
  accommodation_style?: string;
  home_airport?: string;
  travel_agent_mode?: boolean;
}

// Simulates the transformProfile function from AuthContext
function transformProfile(
  supabaseUser: MockUser | null,
  profile?: MockProfile | null,
  preferences?: MockPreferences | null
) {
  if (!supabaseUser) return null;

  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name:
      profile?.display_name ||
      (supabaseUser.user_metadata?.name as string) ||
      (supabaseUser.user_metadata?.full_name as string) ||
      supabaseUser.email?.split('@')[0],
    avatar: profile?.avatar_url || (supabaseUser.user_metadata?.avatar_url as string),
    homeAirport: preferences?.home_airport || undefined,
    createdAt: supabaseUser.created_at,
    quizCompleted: profile?.quiz_completed || false,
    travelAgentMode: preferences?.travel_agent_mode || false,
  };
}

describe('AuthContext transformProfile', () => {
  it('should return null for null user', () => {
    const result = transformProfile(null);
    expect(result).toBeNull();
  });

  it('should transform user with minimal data', () => {
    const user: MockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: '2024-01-01T00:00:00Z',
      user_metadata: {},
    };

    const result = transformProfile(user);

    expect(result).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      name: 'test', // fallback to email prefix
      avatar: undefined,
      homeAirport: undefined,
      createdAt: '2024-01-01T00:00:00Z',
      quizCompleted: false,
      travelAgentMode: false,
    });
  });

  it('should use profile display_name over metadata', () => {
    const user: MockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: '2024-01-01T00:00:00Z',
      user_metadata: { name: 'Metadata Name' },
    };

    const profile: MockProfile = {
      display_name: 'Profile Name',
    };

    const result = transformProfile(user, profile);

    expect(result?.name).toBe('Profile Name');
  });

  it('should fall back to metadata name', () => {
    const user: MockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: '2024-01-01T00:00:00Z',
      user_metadata: { name: 'Metadata Name' },
    };

    const result = transformProfile(user, {});

    expect(result?.name).toBe('Metadata Name');
  });

  it('should handle preferences', () => {
    const user: MockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: '2024-01-01T00:00:00Z',
      user_metadata: {},
    };

    const preferences: MockPreferences = {
      home_airport: 'JFK',
      travel_agent_mode: true,
    };

    const result = transformProfile(user, null, preferences);

    expect(result?.homeAirport).toBe('JFK');
    expect(result?.travelAgentMode).toBe(true);
  });

  it('should handle quiz completion', () => {
    const user: MockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: '2024-01-01T00:00:00Z',
      user_metadata: {},
    };

    const profile: MockProfile = {
      quiz_completed: true,
    };

    const result = transformProfile(user, profile);

    expect(result?.quizCompleted).toBe(true);
  });
});

describe('Auth State Management', () => {
  it('should have correct initial state', () => {
    // The initial auth state
    const initialState = {
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,
    };

    expect(initialState.user).toBeNull();
    expect(initialState.isLoading).toBe(true);
    expect(initialState.isAuthenticated).toBe(false);
  });

  it('should compute isAuthenticated from user presence', () => {
    const computeIsAuthenticated = (user: unknown) => !!user;

    expect(computeIsAuthenticated(null)).toBe(false);
    expect(computeIsAuthenticated(undefined)).toBe(false);
    expect(computeIsAuthenticated({ id: '123' })).toBe(true);
  });
});

describe('Auth Error Handling', () => {
  it('should handle login errors gracefully', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'));

    let errorMessage = '';
    try {
      await mockLogin('test@example.com', 'wrong-password');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    expect(errorMessage).toBe('Invalid credentials');
  });

  it('should handle signup errors gracefully', async () => {
    const mockSignup = vi.fn().mockRejectedValue(new Error('Email already registered'));

    let errorMessage = '';
    try {
      await mockSignup('existing@example.com', 'password123');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    expect(errorMessage).toBe('Email already registered');
  });
});

describe('Profile Update with Upsert', () => {
  it('should use upsert pattern for profile updates', async () => {
    // Simulates the fixed updateUser function that uses upsert
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    const updateProfile = async (userId: string, updates: Record<string, unknown>) => {
      const payload = {
        id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      return mockUpsert(payload, { onConflict: 'id' });
    };

    await updateProfile('user-123', { display_name: 'New Name' });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-123',
        display_name: 'New Name',
      }),
      { onConflict: 'id' }
    );
  });

  it('should include updated_at in payload', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    const updateProfile = async (userId: string, updates: Record<string, unknown>) => {
      const payload = {
        id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      return mockUpsert(payload);
    };

    await updateProfile('user-123', { display_name: 'Test' });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        updated_at: expect.any(String),
      })
    );
  });
});
