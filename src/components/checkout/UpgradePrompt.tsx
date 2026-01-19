import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Zap, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { STRIPE_PRODUCTS } from '@/config/pricing';

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  context?: 'regenerate' | 'route' | 'budget' | 'general';
}

export function UpgradePrompt({
  isOpen,
  onClose,
  featureName = 'this feature',
  context = 'general',
}: UpgradePromptProps) {

  const getContextMessage = () => {
    switch (context) {
      case 'regenerate':
        return 'You have used your free itinerary build for this month. Upgrade to regenerate days and rebuild itineraries as often as you like.';
      case 'route':
        return 'You have used your route optimizations for this month. Upgrade for unlimited route planning.';
      case 'budget':
        return 'You have used your group budget setup for this month. Upgrade to manage budgets across all your trips.';
      default:
        return `To use ${featureName}, upgrade your plan for unlimited access.`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl font-serif">
            Upgrade to Continue
          </DialogTitle>
          <DialogDescription className="text-center">
            {getContextMessage()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          {/* Trip Pass */}
          <div className="rounded-lg border border-border p-4 hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-sm">Trip Pass</h4>
              </div>
              <span className="text-sm font-semibold">${STRIPE_PRODUCTS.TRIP_PASS.price}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Unlimited rebuilds for this one trip. Best for planning a specific trip.
            </p>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to={ROUTES.PRICING}>
                Get Trip Pass
                <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </div>

          {/* Monthly */}
          <div className="rounded-lg border-2 border-primary p-4 bg-primary/5">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-sm">Monthly</h4>
                <span className="text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground rounded">Popular</span>
              </div>
              <span className="text-sm font-semibold">${STRIPE_PRODUCTS.MONTHLY.price}/mo</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Unlimited everything. Plan multiple trips with smart recommendations.
            </p>
            <Button asChild size="sm" className="w-full">
              <Link to={ROUTES.PRICING}>
                Go Monthly
                <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </div>

          {/* Yearly mention */}
          <p className="text-center text-xs text-muted-foreground">
            Or save 48% with <Link to={ROUTES.PRICING} className="text-primary hover:underline">Yearly at ${STRIPE_PRODUCTS.YEARLY.price}/year</Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
