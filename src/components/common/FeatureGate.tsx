/**
 * Feature Gate Component
 * 
 * Wraps UI elements that require specific entitlements.
 * Shows upgrade prompts when features are blocked.
 */

import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { ROUTES } from '@/config/routes';

interface FeatureGateProps {
  /** Whether the feature is allowed */
  allowed: boolean;
  /** Whether entitlements are still loading */
  isLoading?: boolean;
  /** Reason for block (for messaging) */
  blockReason?: string | null;
  /** Feature name for display */
  featureName?: string;
  /** Suggested upgrade path */
  upgradePath?: 'trip_pass' | 'monthly' | 'yearly' | null;
  /** Current trip ID (for trip pass purchases) */
  tripId?: string;
  /** If true, shows a dialog instead of inline message */
  showDialog?: boolean;
  /** Dialog open state (controlled) */
  dialogOpen?: boolean;
  /** Dialog close callback */
  onDialogClose?: () => void;
  /** Children to render when allowed */
  children: ReactNode;
  /** Fallback content when blocked (if not using dialog) */
  fallback?: ReactNode;
}

export function FeatureGate({
  allowed,
  isLoading = false,
  blockReason,
  featureName = 'This feature',
  upgradePath,
  tripId,
  showDialog = false,
  dialogOpen = false,
  onDialogClose,
  children,
  fallback,
}: FeatureGateProps) {
  const navigate = useNavigate();

  // While loading, show children optimistically
  if (isLoading) {
    return <>{children}</>;
  }

  // If allowed, render children
  if (allowed) {
    return <>{children}</>;
  }

  // Build upgrade CTA
  const getUpgradeCTA = () => {
    switch (upgradePath) {
      case 'trip_pass':
        return {
          label: 'Unlock This Trip ($12.99)',
          action: () => navigate(`${ROUTES.PRICING}?highlight=trip_pass&tripId=${tripId || ''}`),
        };
      case 'monthly':
        return {
          label: 'Go Monthly ($15.99/mo)',
          action: () => navigate(`${ROUTES.PRICING}?highlight=monthly`),
        };
      case 'yearly':
        return {
          label: 'Go Yearly (Save 48%)',
          action: () => navigate(`${ROUTES.PRICING}?highlight=yearly`),
        };
      default:
        return {
          label: 'View Plans',
          action: () => navigate(ROUTES.PRICING),
        };
    }
  };

  const cta = getUpgradeCTA();

  // Dialog mode
  if (showDialog) {
    return (
      <>
        {children}
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && onDialogClose?.()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" />
                {featureName} Locked
              </DialogTitle>
              <DialogDescription className="text-left">
                {blockReason || `Upgrade to unlock ${featureName.toLowerCase()}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <Sparkles className="w-8 h-8 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Unlock more with a subscription</p>
                  <p className="text-sm text-muted-foreground">
                    Get unlimited rebuilds, AI optimization, and more.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={onDialogClose}>
                Maybe Later
              </Button>
              <Button onClick={cta.action} className="gap-2">
                {cta.label}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Inline fallback mode
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default inline block message
  return (
    <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-muted/50 border border-border">
      <Lock className="w-8 h-8 text-muted-foreground" />
      <p className="text-center text-sm text-muted-foreground max-w-xs">
        {blockReason || `Upgrade to unlock ${featureName.toLowerCase()}.`}
      </p>
      <Button size="sm" onClick={cta.action} className="gap-2">
        {cta.label}
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default FeatureGate;
