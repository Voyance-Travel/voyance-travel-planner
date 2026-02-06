/**
 * Integration Tests for Race Condition Guards
 * 
 * Tests the pattern used to prevent duplicate saves from rapid clicks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef, useCallback, useState } from 'react';

// Simulates the race condition guard pattern used in OnboardConversation and TripPlannerContext
function useRaceGuardedSave(saveFn: () => Promise<void>) {
  const savingInProgressRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  
  const save = useCallback(async () => {
    // Guard against concurrent saves
    if (savingInProgressRef.current) {
      console.log('[RaceGuard] Save blocked - already in progress');
      return false;
    }
    
    savingInProgressRef.current = true;
    setIsSaving(true);
    
    try {
      await saveFn();
      setSaveCount(prev => prev + 1);
      return true;
    } finally {
      setIsSaving(false);
      savingInProgressRef.current = false;
    }
  }, [saveFn]);
  
  return { save, isSaving, saveCount };
}

describe('Race Condition Guard Pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow first save to proceed', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    
    const { result } = renderHook(() => useRaceGuardedSave(mockSave));
    
    let saveResult: boolean | undefined;
    await act(async () => {
      saveResult = await result.current.save();
    });
    
    expect(saveResult).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(result.current.saveCount).toBe(1);
  });

  it('should block concurrent saves', async () => {
    // Create a slow save that takes time to complete
    let resolvePromise: () => void;
    const slowPromise = new Promise<void>(resolve => {
      resolvePromise = resolve;
    });
    const mockSave = vi.fn().mockReturnValue(slowPromise);
    
    const { result } = renderHook(() => useRaceGuardedSave(mockSave));
    
    // Start first save (don't await)
    let firstSavePromise: Promise<boolean>;
    act(() => {
      firstSavePromise = result.current.save();
    });
    
    // Immediately try second save - should be blocked
    let secondSaveResult: boolean | undefined;
    await act(async () => {
      secondSaveResult = await result.current.save();
    });
    
    expect(secondSaveResult).toBe(false);
    
    // Complete the first save
    await act(async () => {
      resolvePromise!();
      await firstSavePromise;
    });
    
    // Only one save should have been called
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(result.current.saveCount).toBe(1);
  });

  it('should allow save after previous completes', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    
    const { result } = renderHook(() => useRaceGuardedSave(mockSave));
    
    // First save
    await act(async () => {
      await result.current.save();
    });
    
    // Second save after first completes
    await act(async () => {
      await result.current.save();
    });
    
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(result.current.saveCount).toBe(2);
  });

  it('should reset guard even if save throws', async () => {
    const mockSave = vi.fn().mockRejectedValue(new Error('Save failed'));
    
    const { result } = renderHook(() => useRaceGuardedSave(mockSave));
    
    // First save (will throw)
    await act(async () => {
      try {
        await result.current.save();
      } catch {
        // Expected
      }
    });
    
    // Should be able to try again
    mockSave.mockResolvedValue(undefined);
    
    let secondResult: boolean | undefined;
    await act(async () => {
      secondResult = await result.current.save();
    });
    
    expect(secondResult).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(2);
  });

  it('should set isSaving state correctly', async () => {
    let resolvePromise: () => void;
    const slowPromise = new Promise<void>(resolve => {
      resolvePromise = resolve;
    });
    const mockSave = vi.fn().mockReturnValue(slowPromise);
    
    const { result } = renderHook(() => useRaceGuardedSave(mockSave));
    
    expect(result.current.isSaving).toBe(false);
    
    // Start save
    let savePromise: Promise<boolean>;
    act(() => {
      savePromise = result.current.save();
    });
    
    // Should be saving now
    expect(result.current.isSaving).toBe(true);
    
    // Complete save
    await act(async () => {
      resolvePromise!();
      await savePromise;
    });
    
    // Should no longer be saving
    expect(result.current.isSaving).toBe(false);
  });

  it('should handle rapid fire clicks (stress test)', async () => {
    const mockSave = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 10))
    );
    
    const { result } = renderHook(() => useRaceGuardedSave(mockSave));
    
    // Simulate 10 rapid clicks
    const promises: Promise<boolean>[] = [];
    act(() => {
      for (let i = 0; i < 10; i++) {
        promises.push(result.current.save());
      }
    });
    
    await act(async () => {
      await Promise.all(promises);
    });
    
    // Only the first should have gone through
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(result.current.saveCount).toBe(1);
  });
});
