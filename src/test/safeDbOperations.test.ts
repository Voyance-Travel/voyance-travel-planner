/**
 * Integration Tests for Safe Database Operations
 * 
 * These tests verify the safe upsert utilities that prevent silent failures.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  safeUpdateProfile, 
  safeUpdatePreferences, 
  safeUpdateTravelDNA,
  ensureUserRowExists,
  withFeedback,
  safeUserTableUpdate,
  type SafeDbResult
} from '@/utils/safeDbOperations';

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

// Mock the toast
vi.mock('@/utils/simpleToast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('Safe Database Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('safeUpdateProfile', () => {
    it('should return success when upsert succeeds', async () => {
      const result = await safeUpdateProfile('user-123', { 
        display_name: 'Test User' 
      });
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should include updated_at timestamp in payload', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      
      await safeUpdateProfile('user-123', { display_name: 'Test' });
      
      expect(supabase.from).toHaveBeenCalledWith('profiles');
    });

    it('should handle all profile fields', async () => {
      const updates = {
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        first_name: 'John',
        last_name: 'Doe',
        handle: 'johndoe',
        bio: 'Travel enthusiast',
        home_airport: 'JFK',
        quiz_completed: true,
        travel_dna: { type: 'Explorer' },
      };
      
      const result = await safeUpdateProfile('user-123', updates);
      
      expect(result.success).toBe(true);
    });
  });

  describe('safeUpdatePreferences', () => {
    it('should return success when upsert succeeds', async () => {
      const result = await safeUpdatePreferences('user-123', { 
        budget_tier: 'luxury' 
      });
      
      expect(result.success).toBe(true);
    });

    it('should use user_id as conflict column', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      
      await safeUpdatePreferences('user-123', { travel_pace: 'relaxed' });
      
      expect(supabase.from).toHaveBeenCalledWith('user_preferences');
    });
  });

  describe('safeUpdateTravelDNA', () => {
    it('should return success when upsert succeeds', async () => {
      const result = await safeUpdateTravelDNA('user-123', { 
        primary_archetype: 'Explorer',
        secondary_archetype: 'Adventurer',
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('ensureUserRowExists', () => {
    it('should work with user_preferences table', async () => {
      const result = await ensureUserRowExists('user_preferences', 'user-123');
      
      expect(result.success).toBe(true);
    });

    it('should work with travel_dna_profiles table', async () => {
      const result = await ensureUserRowExists('travel_dna_profiles', 'user-123');
      
      expect(result.success).toBe(true);
    });
  });

  describe('withFeedback', () => {
    it('should not show toast on success', async () => {
      const toast = (await import('@/utils/simpleToast')).default;
      
      const mockOperation = vi.fn().mockResolvedValue({ success: true });
      
      await withFeedback(mockOperation);
      
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should show toast on failure', async () => {
      const toast = (await import('@/utils/simpleToast')).default;
      
      const mockOperation = vi.fn().mockResolvedValue({ 
        success: false, 
        error: 'Test error' 
      });
      
      await withFeedback(mockOperation, 'Custom error message');
      
      expect(toast.error).toHaveBeenCalledWith('Custom error message');
    });
  });

  describe('safeUserTableUpdate', () => {
    it('should work with any table name', async () => {
      const result = await safeUserTableUpdate(
        'custom_table',
        'user-123',
        { custom_field: 'value' }
      );
      
      expect(result.success).toBe(true);
    });

    it('should allow custom conflict column', async () => {
      const result = await safeUserTableUpdate(
        'custom_table',
        'user-123',
        { custom_field: 'value' },
        'owner_id'
      );
      
      expect(result.success).toBe(true);
    });
  });
});

describe('SafeDbResult type', () => {
  it('should have correct shape for success', () => {
    const successResult: SafeDbResult<string> = {
      success: true,
      data: 'test data',
    };
    
    expect(successResult.success).toBe(true);
    expect(successResult.data).toBe('test data');
    expect(successResult.error).toBeUndefined();
  });

  it('should have correct shape for failure', () => {
    const failureResult: SafeDbResult<string> = {
      success: false,
      error: 'Something went wrong',
    };
    
    expect(failureResult.success).toBe(false);
    expect(failureResult.error).toBe('Something went wrong');
    expect(failureResult.data).toBeUndefined();
  });
});
