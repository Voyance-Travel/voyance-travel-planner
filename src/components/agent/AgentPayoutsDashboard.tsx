/**
 * Agent Payouts Dashboard
 * 
 * Shows:
 * - Current balance (available + pending)
 * - Payout schedule controls
 * - Transfer history (platform → agent)
 * - Payout history (agent → bank)
 * - Tax compliance status
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
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Banknote,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  DollarSign,
  FileText,
  RefreshCw,
  TrendingUp,
  Building2,
  Shield,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Balance {
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrival_date: number;
  created: number;
  method: string;
}

interface Transfer {
  id: string;
  amount: number;
  currency: string;
  created: number;
  description: string;
  metadata: Record<string, string>;
}

const SCHEDULE_OPTIONS = [
  { value: 'manual', label: 'Manual', description: 'Request payouts when you want' },
  { value: 'daily', label: 'Daily', description: 'Automatic daily payouts' },
  { value: 'weekly', label: 'Weekly', description: 'Every Monday' },
  { value: 'monthly', label: 'Monthly', description: '1st of each month' },
];

const STATUS_BADGES: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  paid: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  pending: { color: 'bg-amber-100 text-amber-700', icon: Clock },
  in_transit: { color: 'bg-blue-100 text-blue-700', icon: ArrowUpFromLine },
  canceled: { color: 'bg-red-100 text-red-700', icon: AlertCircle },
  failed: { color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export default function AgentPayoutsDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [schedule, setSchedule] = useState('manual');
  const [hasAccount, setHasAccount] = useState(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [taxStatus, setTaxStatus] = useState<{
    tax_id_provided: boolean;
    country: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load payout settings first to check if account exists
      const { data: settings } = await supabase.functions.invoke('stripe-connect-payouts', {
        body: { action: 'get_payout_settings' },
      });

      if (!settings?.has_account) {
        setHasAccount(false);
        setIsLoading(false);
        return;
      }

      setHasAccount(true);
      setSchedule(settings.schedule || 'manual');

      // Load balance, payouts, and transfers in parallel
      const [balanceRes, payoutsRes, transfersRes, taxRes] = await Promise.all([
        supabase.functions.invoke('stripe-connect-payouts', { body: { action: 'get_balance' } }),
        supabase.functions.invoke('stripe-connect-payouts', { body: { action: 'get_payouts', limit: 20 } }),
        supabase.functions.invoke('stripe-connect-payouts', { body: { action: 'get_transfers', limit: 20 } }),
        supabase.functions.invoke('stripe-connect-payouts', { body: { action: 'get_tax_status' } }),
      ]);

      if (balanceRes.data?.success) setBalance(balanceRes.data);
      if (payoutsRes.data?.success) setPayouts(payoutsRes.data.payouts || []);
      if (transfersRes.data?.success) setTransfers(transfersRes.data.transfers || []);
      if (taxRes.data?.success) setTaxStatus(taxRes.data);
    } catch (error) {
      console.error('Failed to load payout data:', error);
      toast({ title: 'Failed to load payout data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleChange = async (newSchedule: string) => {
    setIsUpdatingSchedule(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-payouts', {
        body: { action: 'update_payout_schedule', schedule: newSchedule },
      });

      if (error) throw error;
      
      setSchedule(newSchedule);
      toast({ title: 'Payout schedule updated' });
    } catch (error) {
      console.error('Failed to update schedule:', error);
      toast({ title: 'Failed to update schedule', variant: 'destructive' });
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getTotalBalance = (balances: { amount: number; currency: string }[]) => {
    const usd = balances.find(b => b.currency === 'usd');
    return usd ? formatCurrency(usd.amount, 'usd') : '$0.00';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading payout data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!hasAccount) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Payout Account</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Complete Stripe Connect onboarding to view payouts
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-background">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Available Balance</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-600">
              {balance ? getTotalBalance(balance.available) : '$0.00'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Ready to withdraw</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-background">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Pending Balance</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {balance ? getTotalBalance(balance.pending) : '$0.00'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Processing (2-7 days)</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Earned</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(
                transfers.reduce((sum, t) => sum + t.amount, 0),
                'usd'
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">All-time commissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Schedule */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Payout Schedule</CardTitle>
              <CardDescription>Control when funds are sent to your bank</CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-3">
            {SCHEDULE_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => handleScheduleChange(option.value)}
                disabled={isUpdatingSchedule}
                className={`p-4 rounded-lg border text-left transition-all ${
                  schedule === option.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{option.label}</span>
                  {schedule === option.value && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>

          {schedule === 'manual' && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                With manual payouts, you control when funds are transferred. Perfect for the "pay after travel" model.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="transfers">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transfers">
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Earnings ({transfers.length})
              </TabsTrigger>
              <TabsTrigger value="payouts">
                <ArrowUpFromLine className="h-4 w-4 mr-2" />
                Payouts ({payouts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transfers" className="mt-4">
              <ScrollArea className="h-[300px]">
                {transfers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No earnings yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transfers.map(transfer => (
                      <div
                        key={transfer.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                            <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {transfer.description || 'Commission Transfer'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(transfer.created * 1000), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-emerald-600">
                          +{formatCurrency(transfer.amount, transfer.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="payouts" className="mt-4">
              <ScrollArea className="h-[300px]">
                {payouts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Banknote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No payouts yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payouts.map(payout => {
                      const statusConfig = STATUS_BADGES[payout.status] || STATUS_BADGES.pending;
                      const StatusIcon = statusConfig.icon;
                      
                      return (
                        <div
                          key={payout.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <ArrowUpFromLine className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                Bank Transfer
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {payout.arrival_date 
                                  ? `Arrives ${format(new Date(payout.arrival_date * 1000), 'MMM d')}`
                                  : format(new Date(payout.created * 1000), 'MMM d, yyyy')
                                }
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold">
                              {formatCurrency(payout.amount, payout.currency)}
                            </span>
                            <Badge className={`ml-2 ${statusConfig.color}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {payout.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tax Compliance */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">Tax Compliance</CardTitle>
              <CardDescription>1099 forms are generated automatically by Stripe</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
            <Shield className="h-8 w-8 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Automatic 1099 Generation</p>
              <p className="text-sm text-muted-foreground mb-3">
                Stripe handles 1099-K/1099-MISC generation and delivery for US-based agents 
                who exceed IRS reporting thresholds ($600+ in payments).
              </p>
              <div className="flex items-center gap-2 text-sm">
                {taxStatus?.tax_id_provided ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Tax ID Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Tax ID Pending
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  Country: {taxStatus?.country?.toUpperCase() || 'US'}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Risk Mitigation:</strong> Currently, only service fees (planning fees, 
              concierge fees) are routed through this payout system. Full trip funds 
              should be handled directly between clients and suppliers until compliance 
              posture is established.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
