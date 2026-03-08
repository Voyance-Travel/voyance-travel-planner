/**
 * Hook for managing itinerary version history and undo functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  canUndo, 
  undoLastChange, 
  getDayVersionHistory,
  restoreVersion,
  formatVersionLabel,
  type ItineraryVersion
} from '@/services/itineraryVersionHistory';
import type { ItineraryActivity } from '@/types/itinerary';

interface UseVersionHistoryOptions {
  tripId?: string;
  dayNumber: number;
  onRestore?: (activities: ItineraryActivity[], metadata?: { title?: string; theme?: string }) => void;
}

interface UseVersionHistoryReturn {
  canUndoDay: boolean;
  isUndoing: boolean;
  versions: ItineraryVersion[];
  isLoadingVersions: boolean;
  handleUndo: () => Promise<void>;
  handleRestoreVersion: (versionNumber: number) => Promise<void>;
  refreshUndoState: () => Promise<void>;
  loadVersionHistory: () => Promise<void>;
}

export function useVersionHistory({
  tripId,
  dayNumber,
  onRestore,
}: UseVersionHistoryOptions): UseVersionHistoryReturn {
  const { toast } = useToast();
  const [canUndoDay, setCanUndoDay] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [versions, setVersions] = useState<ItineraryVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Check if undo is available
  const refreshUndoState = useCallback(async () => {
    if (!tripId) {
      setCanUndoDay(false);
      return;
    }
    const available = await canUndo(tripId, dayNumber);
    setCanUndoDay(available);
  }, [tripId, dayNumber]);

  // Load on mount and when deps change
  useEffect(() => {
    refreshUndoState();
  }, [refreshUndoState]);

  // Load full version history
  const loadVersionHistory = useCallback(async () => {
    if (!tripId) return;
    
    setIsLoadingVersions(true);
    try {
      const history = await getDayVersionHistory(tripId, dayNumber);
      setVersions(history);
    } finally {
      setIsLoadingVersions(false);
    }
  }, [tripId, dayNumber]);

  // Handle undo action
  const handleUndo = useCallback(async () => {
    if (!tripId) {
      toast({
        title: 'Cannot undo',
        description: 'Trip not found',
        variant: 'destructive',
      });
      return;
    }

    setIsUndoing(true);
    try {
      const result = await undoLastChange(tripId, dayNumber);
      
      if (result.success && result.activities) {
        onRestore?.(result.activities, result.metadata);
        
        toast({
          title: 'Restored previous version',
          description: `Day ${dayNumber} has been restored`,
        });
        
        await refreshUndoState();
      } else {
        toast({
          title: 'Cannot undo',
          description: result.error || 'No previous version available',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[useVersionHistory] Undo error:', error);
      toast({
        title: 'Undo failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUndoing(false);
    }
  }, [tripId, dayNumber, onRestore, toast, refreshUndoState]);

  // Handle restoring a specific version by number
  const handleRestoreVersion = useCallback(async (versionNumber: number) => {
    if (!tripId) return;

    setIsUndoing(true);
    try {
      const result = await restoreVersion(tripId, dayNumber, versionNumber);

      if (result.success && result.activities) {
        onRestore?.(result.activities, result.metadata);
        toast({
          title: 'Version restored',
          description: `Day ${dayNumber} restored to version ${versionNumber}`,
        });
        await refreshUndoState();
        // Refresh the version list too
        await loadVersionHistory();
      } else {
        toast({
          title: 'Restore failed',
          description: result.error || 'Could not restore version',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[useVersionHistory] Restore version error:', error);
      toast({
        title: 'Restore failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUndoing(false);
    }
  }, [tripId, dayNumber, onRestore, toast, refreshUndoState, loadVersionHistory]);

  return {
    canUndoDay,
    isUndoing,
    versions,
    isLoadingVersions,
    handleUndo,
    handleRestoreVersion,
    refreshUndoState,
    loadVersionHistory,
  };
}

// Re-export the formatter for use in components
export { formatVersionLabel };
export type { ItineraryVersion };
