/**
 * Itinerary Utility Bar
 * 
 * Share / Save / Export PDF / Repair Pricing / Regenerate buttons for the itinerary.
 * Positioned below the intelligence summary.
 */

import { useState } from 'react';
import { 
  Share2, Download, Save, Link2, Copy, Check, 
  Mail, MessageCircle, FileText, Wrench, RefreshCw, Loader2, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TripShareModal } from '@/components/sharing/TripShareModal';
import { repairTripCosts } from '@/services/activityCostService';

interface ItineraryUtilityBarProps {
  tripId: string;
  tripName: string;
  destination: string;
  onSave?: () => void;
  onExportPDF?: () => void;
  onRegenerateItinerary?: () => void;
  isSaving?: boolean;
  shareUrl?: string;
  className?: string;
  onCreateShareLink?: () => Promise<string>;
  onRepairComplete?: () => void;
}

export function ItineraryUtilityBar({
  tripId,
  tripName,
  destination,
  onSave,
  onExportPDF,
  onRegenerateItinerary,
  isSaving,
  shareUrl,
  className,
  onCreateShareLink,
  onRepairComplete,
}: ItineraryUtilityBarProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const handleRepairPricing = async () => {
    setIsRepairing(true);
    try {
      const result = await repairTripCosts(tripId);
      if (result.success) {
        toast.success(`Pricing repaired: ${result.repaired} activities updated${result.corrected > 0 ? `, ${result.corrected} outliers corrected` : ''}`);
        onRepairComplete?.();
      } else {
        toast.error(result.error || 'Failed to repair pricing');
      }
    } catch {
      toast.error('Failed to repair pricing');
    } finally {
      setIsRepairing(false);
    }
  };

  const handleExportPDF = () => {
    if (onExportPDF) {
      onExportPDF();
    } else {
      toast.info('Preparing PDF export...', { duration: 2000 });
      setTimeout(() => window.print(), 500);
    }
  };

  return (
    <>
      <div className={cn(
        'flex items-center justify-center gap-2 py-3 px-4 bg-muted/30 rounded-lg border border-border/50 flex-wrap',
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

        {/* Repair Pricing */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={handleRepairPricing}
          disabled={isRepairing}
        >
          {isRepairing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
          <span className="hidden sm:inline">{isRepairing ? 'Repairing...' : 'Repair Pricing'}</span>
        </Button>

        {/* Regenerate Itinerary */}
        {onRegenerateItinerary && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setShowRegenerateConfirm(true)}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Regenerate</span>
          </Button>
        )}

        {/* Export PDF */}
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

      {/* Regenerate Confirmation Dialog */}
      <Dialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Regenerate Itinerary
            </DialogTitle>
            <DialogDescription>
              This will rebuild your day-by-day schedule and pricing from scratch using your original trip settings.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">What's preserved:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Flights & hotels</li>
                <li>✓ Multi-city routing</li>
                <li>✓ Trip dates, travelers & preferences</li>
              </ul>
            </div>
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">What's replaced:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✗ Daily schedule & activities</li>
                <li>✗ Activity pricing</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateConfirm(false)}>Cancel</Button>
            <Button
              variant="default"
              onClick={() => {
                setShowRegenerateConfirm(false);
                onRegenerateItinerary?.();
              }}
            >
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ItineraryUtilityBar;
