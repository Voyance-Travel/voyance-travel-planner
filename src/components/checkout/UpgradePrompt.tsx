import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Zap, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { CREDIT_PACKS, formatCredits } from '@/config/pricing';

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  context?: 'regenerate' | 'route' | 'budget' | 'general' | 'credits';
  creditsNeeded?: number;
}

export function UpgradePrompt({
  isOpen,
  onClose,
  featureName = 'this feature',
  context = 'general',
  creditsNeeded = 0,
}: UpgradePromptProps) {

  const getContextMessage = () => {
    if (creditsNeeded > 0) {
      return `You need ${formatCredits(creditsNeeded)} credits to continue. Get more credits to unlock this feature.`;
    }
    switch (context) {
      case 'regenerate':
        return 'You need more credits to regenerate this day. Get credits to continue.';
      case 'route':
        return 'Route optimization is free! But you need credits to unlock days first.';
      case 'budget':
        return 'Group budgeting is included with any unlocked trip.';
      case 'credits':
        return 'You\'re running low on credits. Top up to keep planning.';
      default:
        return `To use ${featureName}, you need more credits.`;
    }
  };

  // Get recommended pack based on credits needed
  const getRecommendedPack = () => {
    if (creditsNeeded <= 200) return CREDIT_PACKS[0]; // Single
    if (creditsNeeded <= 500) return CREDIT_PACKS[1]; // Starter
    if (creditsNeeded <= 1200) return CREDIT_PACKS[2]; // Explorer
    return CREDIT_PACKS[3]; // Adventurer
  };

  const recommended = getRecommendedPack();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Ticket className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl font-serif">
            Get More Credits
          </DialogTitle>
          <DialogDescription className="text-center">
            {getContextMessage()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          {/* Recommended Pack */}
          <div className="rounded-lg border-2 border-primary p-4 bg-primary/5">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-sm">{recommended.name}</h4>
                <span className="text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground rounded">Recommended</span>
              </div>
              <span className="text-sm font-semibold">${recommended.price}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {formatCredits(recommended.credits)} credits — covers {recommended.description}
            </p>
            <Button asChild size="sm" className="w-full">
              <Link to={ROUTES.PRICING}>
                Get {recommended.name}
                <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </div>

          {/* Smaller Option */}
          {recommended.id !== 'single' && (
            <div className="rounded-lg border border-border p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-sm">Single</h4>
                </div>
                <span className="text-sm font-semibold">$12</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                200 credits — 1 day + extras
              </p>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to={ROUTES.PRICING}>
                  Get Single
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}

          {/* View all options */}
          <p className="text-center text-xs text-muted-foreground">
            <Link to={ROUTES.PRICING} className="text-primary hover:underline">View all credit packs →</Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
