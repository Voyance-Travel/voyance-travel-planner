/**
 * Host Agency Commission Split Manager
 * 
 * Manages commission distribution for agents working under host agencies.
 * Host agencies receive commissions and distribute to member agents.
 * 
 * Model: Commission → Host Agency → Member Agent Split
 */

import { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Percent, 
  DollarSign,
  ArrowRight,
  Settings,
  Save,
  Info,
  CheckCircle2,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CommissionSplitConfig {
  is_host_agency: boolean;
  host_agency_name?: string;
  host_agency_split_percent: number; // Percent host keeps
  agent_split_percent: number; // Percent agent gets (100 - host split)
  payout_method: 'direct' | 'via_host';
  split_applies_to: 'all' | 'commission_track' | 'supplier_direct';
}

interface CommissionSummary {
  total_commission_cents: number;
  host_portion_cents: number;
  agent_portion_cents: number;
  pending_distribution_cents: number;
  distributed_cents: number;
}

interface HostAgencyCommissionSplitProps {
  userId: string;
  onConfigSaved?: (config: CommissionSplitConfig) => void;
}

const DEFAULT_CONFIG: CommissionSplitConfig = {
  is_host_agency: false,
  host_agency_split_percent: 20,
  agent_split_percent: 80,
  payout_method: 'via_host',
  split_applies_to: 'all',
};

export default function HostAgencyCommissionSplit({
  userId,
  onConfigSaved,
}: HostAgencyCommissionSplitProps) {
  const [config, setConfig] = useState<CommissionSplitConfig>(DEFAULT_CONFIG);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<CommissionSplitConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    loadConfig();
    loadCommissionSummary();
  }, [userId]);

  const loadConfig = async () => {
    try {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('commission_split_config')
        .eq('user_id', userId)
        .single();

      if (prefs?.commission_split_config) {
        const savedConfig = prefs.commission_split_config as unknown as CommissionSplitConfig;
        setConfig(savedConfig);
        setTempConfig(savedConfig);
      }
    } catch (error) {
      console.error('Failed to load commission config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCommissionSummary = async () => {
    try {
      // Calculate total commissions from booking segments
      const { data: segments } = await supabase
        .from('agency_booking_segments')
        .select('commission_cents, commission_expected_cents, commission_received_cents, settlement_type')
        .eq('agent_id', userId);

      if (segments) {
        const totalCommission = segments.reduce((sum, s) => 
          sum + (s.commission_expected_cents || s.commission_cents || 0), 0);
        const receivedCommission = segments.reduce((sum, s) => 
          sum + (s.commission_received_cents || 0), 0);

        const hostPortion = Math.round(totalCommission * (config.host_agency_split_percent / 100));
        const agentPortion = totalCommission - hostPortion;

        setSummary({
          total_commission_cents: totalCommission,
          host_portion_cents: hostPortion,
          agent_portion_cents: agentPortion,
          pending_distribution_cents: totalCommission - receivedCommission,
          distributed_cents: receivedCommission,
        });
      }
    } catch (error) {
      console.error('Failed to load commission summary:', error);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      // Ensure splits add to 100
      const adjustedConfig = {
        ...tempConfig,
        agent_split_percent: 100 - tempConfig.host_agency_split_percent,
      };

      const { error } = await supabase
        .from('user_preferences')
        .update({ 
          commission_split_config: JSON.parse(JSON.stringify(adjustedConfig))
        })
        .eq('user_id', userId);

      if (error) throw error;

      setConfig(adjustedConfig);
      setEditModalOpen(false);
      onConfigSaved?.(adjustedConfig);
      
      // Refresh summary with new splits
      loadCommissionSummary();
      
      toast({ title: 'Commission split settings saved' });
    } catch (error) {
      console.error('Failed to save config:', error);
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Host Agency Commission Split
              </CardTitle>
              <CardDescription>
                {config.is_host_agency 
                  ? 'Configure how commissions are distributed to member agents'
                  : 'Configure your commission split with your host agency'
                }
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Split Configuration */}
          <div className="flex items-center justify-center gap-6 py-4">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Host Agency</p>
              <p className="text-2xl font-bold">{config.host_agency_split_percent}%</p>
            </div>
            
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
            
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                <Users className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-sm text-muted-foreground">Your Share</p>
              <p className="text-2xl font-bold text-emerald-600">{config.agent_split_percent}%</p>
            </div>
          </div>

          {/* Commission Summary */}
          {summary && (
            <>
              <Separator />
              
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Commission</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(summary.total_commission_cents)}</p>
                </div>
                
                <div className="p-4 rounded-lg bg-primary/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Host Portion</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(summary.host_portion_cents)}</p>
                </div>
                
                <div className="p-4 rounded-lg bg-emerald-500/10">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm text-muted-foreground">Your Earnings</span>
                  </div>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.agent_portion_cents)}</p>
                </div>
              </div>

              {/* Distribution Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Distribution Progress</span>
                  <span className="font-medium">
                    {formatCurrency(summary.distributed_cents)} / {formatCurrency(summary.total_commission_cents)}
                  </span>
                </div>
                <Progress 
                  value={summary.total_commission_cents > 0 
                    ? (summary.distributed_cents / summary.total_commission_cents) * 100 
                    : 0
                  } 
                />
                {summary.pending_distribution_cents > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formatCurrency(summary.pending_distribution_cents)} pending distribution
                  </p>
                )}
              </div>
            </>
          )}

          {/* Payout Method Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {config.payout_method === 'via_host' 
                ? 'Commissions paid via host agency'
                : 'Direct payout to your account'
              }
            </Badge>
            <Badge variant="secondary">
              Split applies to: {config.split_applies_to === 'all' ? 'All bookings' : config.split_applies_to}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Commission Split Settings</DialogTitle>
            <DialogDescription>
              Configure how commissions are split between you and your host agency
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Host Agency Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>I am a Host Agency</Label>
                <p className="text-xs text-muted-foreground">
                  Toggle if you manage other agents
                </p>
              </div>
              <Switch
                checked={tempConfig.is_host_agency}
                onCheckedChange={(v) => setTempConfig(prev => ({ ...prev, is_host_agency: v }))}
              />
            </div>

            <Separator />

            {/* Host Agency Name */}
            {!tempConfig.is_host_agency && (
              <div>
                <Label>Host Agency Name</Label>
                <Input
                  value={tempConfig.host_agency_name || ''}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, host_agency_name: e.target.value }))}
                  placeholder="Your host agency name"
                />
              </div>
            )}

            {/* Split Percentage */}
            <div>
              <Label>Host Agency Split (%)</Label>
              <div className="flex items-center gap-4 mt-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={tempConfig.host_agency_split_percent}
                  onChange={(e) => {
                    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                    setTempConfig(prev => ({ 
                      ...prev, 
                      host_agency_split_percent: val,
                      agent_split_percent: 100 - val,
                    }));
                  }}
                  className="w-24"
                />
                <span className="text-muted-foreground">→ Your share:</span>
                <span className="font-bold text-emerald-600">{100 - tempConfig.host_agency_split_percent}%</span>
              </div>
            </div>

            {/* Payout Method */}
            <div>
              <Label>Payout Method</Label>
              <Select
                value={tempConfig.payout_method}
                onValueChange={(v: 'direct' | 'via_host') => 
                  setTempConfig(prev => ({ ...prev, payout_method: v }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="via_host">
                    Via Host Agency (they distribute to you)
                  </SelectItem>
                  <SelectItem value="direct">
                    Direct to Your Account
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Split Applies To */}
            <div>
              <Label>Split Applies To</Label>
              <Select
                value={tempConfig.split_applies_to}
                onValueChange={(v: 'all' | 'commission_track' | 'supplier_direct') => 
                  setTempConfig(prev => ({ ...prev, split_applies_to: v }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bookings</SelectItem>
                  <SelectItem value="commission_track">Commission Track Only</SelectItem>
                  <SelectItem value="supplier_direct">Supplier Direct Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Info Box */}
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-200 text-sm">
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-blue-800">
                  <strong>How this works:</strong>
                  <ul className="list-disc list-inside mt-1 text-xs space-y-1">
                    <li>Commissions are calculated on each booking segment</li>
                    <li>Host agency portion is tracked separately</li>
                    <li>Your share shows in payout dashboard</li>
                    <li>Viator/supplier commissions roll up to host, then split</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig} disabled={isSaving}>
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Saving...
                </span>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
