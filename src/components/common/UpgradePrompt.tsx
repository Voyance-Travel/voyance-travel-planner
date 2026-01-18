/**
 * UpgradePrompt Component
 * 
 * Shows when a user tries to access a feature they don't have access to.
 * Links to subscription page for upgrade.
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Sparkles, Crown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UpgradePromptProps {
  feature: string;
  reason: 'disabled' | 'limit_reached' | 'unauthenticated';
  remaining?: number;
  limit?: number;
  variant?: 'inline' | 'modal' | 'card';
  className?: string;
}

export function UpgradePrompt({
  feature,
  reason,
  remaining,
  limit,
  variant = 'card',
  className,
}: UpgradePromptProps) {
  const getMessage = () => {
    if (reason === 'unauthenticated') {
      return {
        title: 'Sign in to continue',
        description: `Create an account to access ${feature}.`,
        cta: 'Sign In',
        link: '/signin',
      };
    }
    
    if (reason === 'limit_reached') {
      return {
        title: 'Limit reached',
        description: `You've used all ${limit} ${feature} this month. Upgrade for unlimited access.`,
        cta: 'Upgrade Now',
        link: '/profile?tab=subscription',
      };
    }
    
    return {
      title: 'Premium Feature',
      description: `${feature} is available on Voyance Pro.`,
      cta: 'Upgrade Now',
      link: '/profile?tab=subscription',
    };
  };

  const { title, description, cta, link } = getMessage();

  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Lock className="h-4 w-4" />
        <span>{description}</span>
        <Link to={link} className="text-primary hover:underline font-medium">
          {cta}
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 p-6 text-center",
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      
      <div className="relative z-10">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          {reason === 'unauthenticated' ? (
            <Lock className="h-6 w-6 text-primary" />
          ) : reason === 'limit_reached' ? (
            <Sparkles className="h-6 w-6 text-primary" />
          ) : (
            <Crown className="h-6 w-6 text-primary" />
          )}
        </div>
        
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">{description}</p>
        
        <Button asChild>
          <Link to={link}>
            {cta}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Feature Gate Wrapper
// ============================================================================

interface FeatureGateProps {
  flag: string;
  entitlements: Record<string, { enabled: boolean; limit?: number; used?: number }> | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  featureName: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({
  flag,
  entitlements,
  isLoading,
  isAuthenticated,
  featureName,
  children,
  fallback,
}: FeatureGateProps) {
  // Loading state
  if (isLoading) {
    return fallback || null;
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <UpgradePrompt 
        feature={featureName} 
        reason="unauthenticated" 
      />
    );
  }

  // Check entitlement
  const ent = entitlements?.[flag];
  
  if (!ent || !ent.enabled) {
    return (
      <UpgradePrompt 
        feature={featureName} 
        reason="disabled" 
      />
    );
  }

  // Check limit
  if (ent.limit !== undefined) {
    const used = ent.used ?? 0;
    if (used >= ent.limit) {
      return (
        <UpgradePrompt 
          feature={featureName} 
          reason="limit_reached"
          remaining={0}
          limit={ent.limit}
        />
      );
    }
  }

  return <>{children}</>;
}

export default UpgradePrompt;
