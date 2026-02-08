/**
 * Itinerary Utility Bar
 * 
 * Share / Save / Export PDF / Print buttons for the itinerary.
 * Positioned below the intelligence summary.
 */

import { useState } from 'react';
import { 
  Share2, Download, Save, Link2, Copy, Check, 
  Mail, MessageCircle, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TripShareModal } from '@/components/sharing/TripShareModal';

interface ItineraryUtilityBarProps {
  tripId: string;
  tripName: string;
  destination: string;
  onSave?: () => void;
  onExportPDF?: () => void;
  isSaving?: boolean;
  shareUrl?: string;
  className?: string;
  onCreateShareLink?: () => Promise<string>;
}

export function ItineraryUtilityBar({
  tripId,
  tripName,
  destination,
  onSave,
  onExportPDF,
  isSaving,
  shareUrl,
  className,
  onCreateShareLink,
}: ItineraryUtilityBarProps) {
  const [showShareModal, setShowShareModal] = useState(false);

  

  const handleExportPDF = () => {
    if (onExportPDF) {
      onExportPDF();
    } else {
      toast.info('Preparing PDF export...', { duration: 2000 });
      // Fallback: trigger print dialog which can save as PDF
      setTimeout(() => window.print(), 500);
    }
  };

  return (
    <>
      <div className={cn(
        'flex items-center justify-center gap-2 py-3 px-4 bg-muted/30 rounded-lg border border-border/50',
        className
      )}>
        {/* Share - Primary CTA */}
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 font-medium border-primary/30 hover:bg-primary/10 hover:text-primary hover:border-primary/50"
          onClick={() => setShowShareModal(true)}
        >
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </Button>

        {/* Save */}
        {onSave && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2" 
            onClick={onSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
          </Button>
        )}

        {/* Export PDF — hidden when gated (onExportPDF is undefined) */}
        {onExportPDF && (
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleExportPDF}>
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        )}

      </div>

      {/* Share Modal */}
      <TripShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        tripId={tripId}
        tripName={tripName}
        destination={destination}
        shareLink={shareUrl}
        onCreateShareLink={onCreateShareLink}
      />
    </>
  );
}

export default ItineraryUtilityBar;
