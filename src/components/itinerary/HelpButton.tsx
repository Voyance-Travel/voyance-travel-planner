/**
 * HelpButton — persistent "?" circle (bottom-left).
 * Offers "Retake Tour" and a compact "Feature Guide".
 */

import { useState } from 'react';
import {
  Lock, RefreshCw, Route, ArrowRightLeft, MessageCircle,
  Zap, Share2, Wallet, CreditCard, FileText,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useResetItineraryTour } from './ItineraryOnboardingTour';
import { cn } from '@/lib/utils';

interface HelpButtonProps {
  /** Hide when tour is active */
  tourActive?: boolean;
  onRetakeTour?: () => void;
}

const FEATURES = [
  { icon: Lock, label: 'Lock', desc: 'Protect activities from changes' },
  { icon: RefreshCw, label: 'Regenerate', desc: 'Fresh activity suggestions' },
  { icon: Route, label: 'Routes', desc: 'Map directions between activities' },
  { icon: ArrowRightLeft, label: 'Swap', desc: 'Find alternatives (3 free per trip)' },
  { icon: MessageCircle, label: 'Assistant', desc: 'Chat to customize your plan' },
  { icon: Zap, label: 'Optimize', desc: 'AI-improve the whole trip' },
  { icon: Share2, label: 'Share', desc: 'Invite companions, set permissions' },
  { icon: Wallet, label: 'Budget', desc: 'Set & track trip spending' },
  { icon: CreditCard, label: 'Payments', desc: 'Track expenses & split bills' },
  { icon: FileText, label: 'Export PDF', desc: 'Printable itinerary' },
];

export function HelpButton({ tourActive, onRetakeTour }: HelpButtonProps) {
  const resetTour = useResetItineraryTour();
  const [open, setOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  if (tourActive) return null;

  const handleRetake = () => {
    resetTour();
    setOpen(false);
    setShowGuide(false);
    onRetakeTour?.();
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setShowGuide(false); }}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'fixed bottom-6 left-6 z-40 h-7 w-7 rounded-full',
            'flex items-center justify-center text-xs font-semibold',
            'bg-muted text-muted-foreground border border-border',
            'opacity-40 hover:opacity-70 transition-opacity',
          )}
          aria-label="Help"
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-64 p-0">
        {!showGuide ? (
          <div className="p-2 space-y-1">
            <button
              onClick={handleRetake}
              className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
            >
              🔄 Retake Tour
            </button>
            <button
              onClick={() => setShowGuide(true)}
              className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
            >
              📖 Feature Guide
            </button>
          </div>
        ) : (
          <div className="p-3 max-h-80 overflow-y-auto">
            <h4 className="text-sm font-semibold mb-2">Your Itinerary Toolkit</h4>
            <div className="space-y-2">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  <div>
                    <span className="text-xs font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground"> — {desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
