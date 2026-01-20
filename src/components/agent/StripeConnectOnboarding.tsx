/**
 * Stripe Connect Onboarding Component
 * 
 * Allows agents to:
 * - Create a Stripe Connect Express account
 * - Complete identity verification
 * - Access their Express Dashboard
 * - View payout status
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Banknote,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Shield,
  CreditCard,
  Building2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ConnectStatus {
  status: 'not_started' | 'pending' | 'complete' | 'restricted';
  onboarding_complete: boolean;
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    past_due?: string[];
  };
}

const STATUS_CONFIG = {
  not_started: {
    label: 'Not Started',
    color: 'bg-gray-100 text-gray-700',
    icon: Building2,
    progress: 0,
  },
  pending: {
    label: 'Verification Pending',
    color: 'bg-amber-100 text-amber-700',
    icon: AlertCircle,
    progress: 50,
  },
  complete: {
    label: 'Active',
    color: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle2,
    progress: 100,
  },
  restricted: {
    label: 'Action Required',
    color: 'bg-red-100 text-red-700',
    icon: AlertCircle,
    progress: 75,
  },
};

export default function StripeConnectOnboarding() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);

  useEffect(() => {
    checkStatus();
    
    // Check for return from Stripe
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_success') === 'true') {
      toast({ title: 'Stripe onboarding completed!' });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      checkStatus();
    } else if (params.get('stripe_refresh') === 'true') {
      toast({ title: 'Please complete the remaining steps', variant: 'destructive' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const checkStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        body: { action: 'check_status' },
      });

      if (error) throw error;
      setConnectStatus(data);
    } catch (error) {
      console.error('Failed to check status:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleCreateAccount = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        body: { action: 'create_account' },
      });

      if (error) throw error;

      if (data.onboarding_url) {
        window.open(data.onboarding_url, '_blank');
        toast({ title: 'Opening Stripe onboarding...' });
      }
    } catch (error) {
      console.error('Failed to create account:', error);
      toast({ 
        title: 'Failed to start onboarding', 
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueOnboarding = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        body: { action: 'get_onboarding_link' },
      });

      if (error) throw error;

      if (data.onboarding_url) {
        window.open(data.onboarding_url, '_blank');
      }
    } catch (error) {
      console.error('Failed to get onboarding link:', error);
      toast({ title: 'Failed to continue onboarding', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        body: { action: 'get_dashboard_link' },
      });

      if (error) throw error;

      if (data.dashboard_url) {
        window.open(data.dashboard_url, '_blank');
      }
    } catch (error) {
      console.error('Failed to open dashboard:', error);
      toast({ title: 'Failed to open dashboard', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const status = connectStatus?.status || 'not_started';
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  if (isCheckingStatus) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Checking payout status...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Banknote className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Agent Payouts</CardTitle>
              <CardDescription>
                Receive payments directly to your bank account
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={config.color}>
              <StatusIcon className="h-3.5 w-3.5 mr-1" />
              {config.label}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={checkStatus}
              disabled={isCheckingStatus}
            >
              <RefreshCw className={`h-4 w-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Setup Progress</span>
            <span className="font-medium">{config.progress}%</span>
          </div>
          <Progress value={config.progress} className="h-2" />
        </div>

        <Separator />

        {/* Status-specific content */}
        {status === 'not_started' && (
          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Secure & Verified</p>
                  <p className="text-xs text-muted-foreground">
                    Stripe handles identity verification and compliance
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <CreditCard className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Fast Payouts</p>
                  <p className="text-xs text-muted-foreground">
                    Receive commissions directly to your bank account
                  </p>
                </div>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={handleCreateAccount}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Set Up Payouts
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You'll be redirected to Stripe to verify your identity
            </p>
          </div>
        )}

        {status === 'pending' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Complete your identity verification to start receiving payouts.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className={`p-3 rounded-lg ${connectStatus?.details_submitted ? 'bg-emerald-50' : 'bg-muted/50'}`}>
                <CheckCircle2 className={`h-5 w-5 mx-auto mb-1 ${connectStatus?.details_submitted ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                <p className="text-xs">Details</p>
              </div>
              <div className={`p-3 rounded-lg ${connectStatus?.charges_enabled ? 'bg-emerald-50' : 'bg-muted/50'}`}>
                <CreditCard className={`h-5 w-5 mx-auto mb-1 ${connectStatus?.charges_enabled ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                <p className="text-xs">Charges</p>
              </div>
              <div className={`p-3 rounded-lg ${connectStatus?.payouts_enabled ? 'bg-emerald-50' : 'bg-muted/50'}`}>
                <Banknote className={`h-5 w-5 mx-auto mb-1 ${connectStatus?.payouts_enabled ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                <p className="text-xs">Payouts</p>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={handleContinueOnboarding}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Continue Setup
            </Button>
          </div>
        )}

        {status === 'complete' && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Payouts Active</span>
              </div>
              <p className="text-sm text-emerald-600 mt-1">
                You're all set to receive commissions and fees.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-emerald-50">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                <p className="text-xs">Verified</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50">
                <CreditCard className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                <p className="text-xs">Charges</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50">
                <Banknote className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                <p className="text-xs">Payouts</p>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleOpenDashboard}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Open Stripe Dashboard
            </Button>
          </div>
        )}

        {status === 'restricted' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Additional information is required. Please complete the remaining steps.
              </AlertDescription>
            </Alert>

            {connectStatus?.requirements?.currently_due && connectStatus.requirements.currently_due.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Required:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {connectStatus.requirements.currently_due.slice(0, 3).map((req, i) => (
                    <li key={i}>• {req.replace(/_/g, ' ')}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button 
              className="w-full" 
              onClick={handleContinueOnboarding}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Complete Verification
            </Button>
          </div>
        )}

        <Separator />

        {/* Footer info */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          <span>Powered by Stripe Connect</span>
        </div>
      </CardContent>
    </Card>
  );
}
