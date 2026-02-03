/**
 * Itinerary Utility Bar
 * 
 * Share / Save / Export PDF / Print buttons for the itinerary.
 * Positioned below the intelligence summary.
 */

import { useState } from 'react';
import { 
  Share2, Download, Printer, Save, Link2, Copy, Check, 
  Mail, MessageCircle, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ItineraryUtilityBarProps {
  tripId: string;
  tripName: string;
  destination: string;
  onSave?: () => void;
  onExportPDF?: () => void;
  isSaving?: boolean;
  shareUrl?: string;
  className?: string;
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
}: ItineraryUtilityBarProps) {
  const [copied, setCopied] = useState(false);

  const effectiveShareUrl = shareUrl || `${window.location.origin}/trip/${tripId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(effectiveShareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async (method: 'native' | 'email' | 'whatsapp') => {
    const shareData = {
      title: tripName,
      text: `Check out my ${destination} itinerary!`,
      url: effectiveShareUrl,
    };

    if (method === 'native' && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error
      }
    } else if (method === 'email') {
      const subject = encodeURIComponent(`My ${destination} Itinerary`);
      const body = encodeURIComponent(`Check out my trip to ${destination}!\n\n${effectiveShareUrl}`);
      window.open(`mailto:?subject=${subject}&body=${body}`);
    } else if (method === 'whatsapp') {
      const text = encodeURIComponent(`Check out my ${destination} itinerary! ${effectiveShareUrl}`);
      window.open(`https://wa.me/?text=${text}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

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
    <div className={cn(
      'flex items-center justify-center gap-2 py-3 px-4 bg-muted/30 rounded-lg border border-border/50',
      className
    )}>
      {/* Share */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            Copy link
          </DropdownMenuItem>
          {navigator.share && (
            <DropdownMenuItem onClick={() => handleShare('native')} className="gap-2">
              <Share2 className="h-4 w-4" />
              Share via...
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleShare('email')} className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('whatsapp')} className="gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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

      {/* Export PDF */}
      <Button variant="ghost" size="sm" className="gap-2" onClick={handleExportPDF}>
        <FileText className="h-4 w-4" />
        <span className="hidden sm:inline">Export PDF</span>
      </Button>

      {/* Print */}
      <Button variant="ghost" size="sm" className="gap-2" onClick={handlePrint}>
        <Printer className="h-4 w-4" />
        <span className="hidden sm:inline">Print</span>
      </Button>
    </div>
  );
}

export default ItineraryUtilityBar;
