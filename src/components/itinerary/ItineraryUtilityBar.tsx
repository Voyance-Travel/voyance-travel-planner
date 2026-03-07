/**
 * Itinerary Utility Bar
 * 
 * Share / Save / Export PDF / Regenerate buttons for the itinerary.
 * On mobile: Share + Export PDF visible, Save/Regenerate in overflow menu.
 */

import { useState } from 'react';
import { 
  Share2, Download, Save, Link2, Copy, Check, 
  Mail, MessageCircle, FileText, RefreshCw, Loader2, AlertTriangle, Coins, MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ItineraryUtilityBarProps {
  tripId: string;
  tripName: string;
  destination: string;
  onSave?: () => void;
  onExportPDF?: () => void;
  onRegenerateItinerary?: () => void;
  onShareClick?: () => void;
  isSaving?: boolean;
  isRegenerating?: boolean;
  regenerationCost?: number;
  dayCount?: number;
  className?: string;
}

export function ItineraryUtilityBar({
  tripId,
  tripName,
  destination,
  onSave,
  onExportPDF,
  onRegenerateItinerary,
  onShareClick,
  isSaving,
  isRegenerating,
  regenerationCost,
  dayCount,
  className,
}: ItineraryUtilityBarProps) {
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const handleExportPDF = () => {
    if (onExportPDF) {
      onExportPDF();
    } else {
      toast.info('Preparing PDF export...', { duration: 2000 });
      setTimeout(() => window.print(), 500);
    }
  };

  const hasOverflowItems = !!onSave || !!onRegenerateItinerary;

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
          onClick={onShareClick}
        >
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </Button>

        {/* Export PDF - visible on all sizes */}
        {onExportPDF && (
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleExportPDF}>
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        )}

        {/* Desktop: show Save and Regenerate inline */}
        {onSave && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 hidden sm:inline-flex" 
            onClick={onSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </Button>
        )}

        {onRegenerateItinerary && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 hidden sm:inline-flex"
            onClick={() => setShowRegenerateConfirm(true)}
            disabled={isRegenerating}
          >
            {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>{isRegenerating ? 'Regenerating…' : 'Regenerate'}</span>
          </Button>
        )}

        {/* Mobile: overflow menu for Save + Regenerate */}
        {hasOverflowItems && (
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {onSave && (
                  <DropdownMenuItem onClick={onSave} disabled={isSaving}>
                    <Save className="h-3.5 w-3.5 mr-2" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </DropdownMenuItem>
                )}
                {onRegenerateItinerary && (
                  <DropdownMenuItem 
                    onClick={() => setShowRegenerateConfirm(true)} 
                    disabled={isRegenerating}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isRegenerating && "animate-spin")} />
                    {isRegenerating ? 'Regenerating…' : 'Regenerate'}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

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
            {regenerationCost != null && (
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{regenerationCost} credits</span>
                  {dayCount != null && (
                    <span className="text-muted-foreground"> ({dayCount} days × 30 credits/day)</span>
                  )}
                </p>
              </div>
            )}
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
              Regenerate{regenerationCost != null ? ` (${regenerationCost} credits)` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ItineraryUtilityBar;
