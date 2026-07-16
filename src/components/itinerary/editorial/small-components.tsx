// Extracted from EditorialItinerary.tsx during the file-size decomposition.
// Small, self-contained UI bits used by the itinerary view.
import { supabase } from '@/integrations/supabase/client';
import { useReconcilingState } from '@/hooks/useReconcilingState';
import { FileText } from 'lucide-react';

// Bounded "Reconciling…" hint — wraps useReconcilingState so the predicate
// in the IIFE-rendered header strip can still drive a hook safely.
export function ReconcilingHint({
  active,
  site,
  tripId,
}: { active: boolean; site: string; tripId?: string | null }) {
  const { visible } = useReconcilingState(active, { site, tripId });
  if (!visible) return null;
  return (
    <div className="text-[11px] text-muted-foreground/60 text-center mt-1" aria-live="polite">
      Reconciling…
    </div>
  );
}

export function BoardingPassViewButton({ storagePath }: { storagePath: string }) {
  const handleView = async () => {
    try {
      const { data } = await supabase.storage
        .from('boarding-passes')
        .createSignedUrl(storagePath, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      console.error('Failed to open boarding pass');
    }
  };
  return (
    <button
      onClick={handleView}
      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
    >
      <FileText className="h-3 w-3" />
      Boarding Pass
    </button>
  );
}
