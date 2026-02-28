/**
 * BlendRecalcBanner — Shows when trip companions changed after generation,
 * prompting the user to regenerate to update the blend.
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface BlendRecalcBannerProps {
  tripId: string;
  onRegenerate?: () => void;
}

export function BlendRecalcBanner({ tripId, onRegenerate }: BlendRecalcBannerProps) {
  const [needsRecalc, setNeedsRecalc] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        // Get trip's blended_dna snapshot
        const { data: trip } = await supabase
          .from('trips')
          .select('blended_dna')
          .eq('id', tripId)
          .maybeSingle();

        const blendedDna = trip?.blended_dna as Record<string, unknown> | null;
        if (!blendedDna?.isBlended) return;

        const snapshotProfiles = (blendedDna.travelerProfiles || blendedDna.travelers) as Array<{ userId?: string; user_id?: string }> | undefined;
        if (!snapshotProfiles?.length) return;

        // Get current collaborators with include_preferences=true
        const { data: collabs } = await supabase
          .from('trip_collaborators')
          .select('user_id, include_preferences')
          .eq('trip_id', tripId)
          .not('accepted_at', 'is', null);

        const currentIncluded = new Set(
          (collabs || [])
            .filter(c => c.include_preferences !== false)
            .map(c => c.user_id)
        );

        const snapshotIds = new Set(
          snapshotProfiles.map(p => p.userId || p.user_id).filter(Boolean)
        );

        // Check if sets differ (ignoring owner who's always present)
        const added = [...currentIncluded].filter(id => !snapshotIds.has(id));
        const removed = [...snapshotIds].filter(id => !currentIncluded.has(id));

        if (added.length > 0 || removed.length > 0) {
          setNeedsRecalc(true);
        }
      } catch {
        // Non-critical
      }
    }
    check();
  }, [tripId]);

  if (!needsRecalc || dismissed) return null;

  return (
    <div className="mx-4 mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Trip companions changed</p>
        <p className="text-xs text-muted-foreground">Regenerate to update the blend with current travelers.</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {onRegenerate && (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onRegenerate}>
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDismissed(true)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
