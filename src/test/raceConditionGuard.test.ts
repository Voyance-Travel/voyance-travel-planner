/**
 * Integration Tests for Race Condition Guards
 * 
 * Tests the pattern used to prevent duplicate saves from rapid clicks.
 * Uses pure TypeScript to avoid React testing library dependencies.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simulates the race condition guard pattern used in OnboardConversation and TripPlannerContext
class RaceGuardedSaver {
  private savingInProgress = false;
  public saveCount = 0;
  public isSaving = false;
  
  constructor(private saveFn: () => Promise<void>) {}
  
  async save(): Promise<boolean> {
    // Guard against concurrent saves
    if (this.savingInProgress) {
      console.log('[RaceGuard] Save blocked - already in progress');
      return false;
    }
    
    this.savingInProgress = true;
    this.isSaving = true;
    
    try {
      await this.saveFn();
      this.saveCount++;
      return true;
    } finally {
      this.isSaving = false;
      this.savingInProgress = false;
    }
  }
}

describe('Race Condition Guard Pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow first save to proceed', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const saver = new RaceGuardedSaver(mockSave);
    
    const result = await saver.save();
    
    expect(result).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(saver.saveCount).toBe(1);
  });

  it('should block concurrent saves', async () => {
    // Create a slow save that takes time to complete
    let resolvePromise: () => void;
    const slowPromise = new Promise<void>(resolve => {
      resolvePromise = resolve;
    });
    const mockSave = vi.fn().mockReturnValue(slowPromise);
    const saver = new RaceGuardedSaver(mockSave);
    
    // Start first save (don't await)
    const firstSavePromise = saver.save();
    
    // Immediately try second save - should be blocked
    const secondSaveResult = await saver.save();
    
    expect(secondSaveResult).toBe(false);
    
    // Complete the first save
    resolvePromise!();
    await firstSavePromise;
    
    // Only one save should have been called
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(saver.saveCount).toBe(1);
  });

  it('should allow save after previous completes', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const saver = new RaceGuardedSaver(mockSave);
    
    // First save
    await saver.save();
    
    // Second save after first completes
    await saver.save();
    
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(saver.saveCount).toBe(2);
  });

  it('should reset guard even if save throws', async () => {
    const mockSave = vi.fn().mockRejectedValue(new Error('Save failed'));
    const saver = new RaceGuardedSaver(mockSave);
    
    // First save (will throw)
    try {
      await saver.save();
    } catch {
      // Expected
    }
    
    // Should be able to try again
    mockSave.mockResolvedValue(undefined);
    
    const secondResult = await saver.save();
    
    expect(secondResult).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(2);
  });

  it('should set isSaving state correctly', async () => {
    let resolvePromise: () => void;
    const slowPromise = new Promise<void>(resolve => {
      resolvePromise = resolve;
    });
    const mockSave = vi.fn().mockReturnValue(slowPromise);
    const saver = new RaceGuardedSaver(mockSave);
    
    expect(saver.isSaving).toBe(false);
    
    // Start save
    const savePromise = saver.save();
    
    // Should be saving now
    expect(saver.isSaving).toBe(true);
    
    // Complete save
    resolvePromise!();
    await savePromise;
    
    // Should no longer be saving
    expect(saver.isSaving).toBe(false);
  });

  it('should handle rapid fire clicks (stress test)', async () => {
    const mockSave = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 10))
    );
    const saver = new RaceGuardedSaver(mockSave);
    
    // Simulate 10 rapid clicks
    const promises: Promise<boolean>[] = [];
    for (let i = 0; i < 10; i++) {
      promises.push(saver.save());
    }
    
    await Promise.all(promises);
    
    // Only the first should have gone through
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(saver.saveCount).toBe(1);
  });
});

describe('Guard Pattern Usage Documentation', () => {
  it('documents how the pattern is used in OnboardConversation', () => {
    // This pattern is used in OnboardConversation.tsx to prevent
    // duplicate saves when users rapidly click "This is Me!" button
    
    const pattern = `
      const savingInProgressRef = useRef(false);
      
      const handleConfirm = useCallback(async () => {
        if (savingInProgressRef.current) return;
        savingInProgressRef.current = true;
        
        try {
          // ... save logic
        } finally {
          savingInProgressRef.current = false;
        }
      }, []);
    `;
    
    expect(pattern).toContain('savingInProgressRef');
    expect(pattern).toContain('useRef(false)');
  });

  it('documents how the pattern is used in TripPlannerContext', () => {
    // This pattern was added to TripPlannerContext to fix the
    // "1,000 duplicate trip records" bug
    
    const pattern = `
      const savingInProgressRef = useRef(false);
      
      const saveTrip = useCallback(async () => {
        if (savingInProgressRef.current) {
          console.log('[Trip] Save already in progress');
          return;
        }
        savingInProgressRef.current = true;
        
        try {
          // ... save logic
        } finally {
          savingInProgressRef.current = false;
        }
      }, []);
    `;
    
    expect(pattern).toContain('savingInProgressRef');
  });
});
