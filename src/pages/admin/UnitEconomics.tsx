/**
 * Admin Unit Economics Dashboard
 * Tracks margins, credit usage, API costs, and customer metrics
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  TrendingUp, 
  Users, 
  CreditCard, 
  Coins,
  Activity,
  DollarSign,
  BarChart3,
  Zap,
  PieChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';
import { 
  FIXED_COSTS, 
  CREDIT_ACTION_COSTS,
  AI_COST_PER_ACTION,
  calculateUnitEconomics,
  formatUSD,
  formatNumber,
  formatPercent,
} from '@/config/unitEconomics';
import { cn } from '@/lib/utils';

// ============================================================================
// Sub-components
// ============================================================================

function MetricCard({ 
  label, 
  value, 
  sub, 
  icon: Icon,
  trend,
  className,
}: { 
  label: string; 
  value: string; 
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}) {
  const trendColors = {
    up: 'text-chart-2',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn(
              'text-2xl font-bold tracking-tight',
              trend && trendColors[trend]
            )}>
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CostBreakdownBar({ 
  label, 
  value, 
  max, 
  color,
  amount,
}: { 
  label: string; 
  value: number; 
  max: number; 
  color: string;
  amount: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{amount}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function ActivityBreakdownRow({
  action,
  count,
  credits,
  cost,
}: {
  action: string;
  count: number;
  credits: number;
  cost: number;
}) {
  const actionLabels: Record<string, string> = {
    unlock_day: 'Unlock Day',
    swap_activity: 'Swap Activity',
    regenerate_day: 'Regenerate Day',
    restaurant_rec: 'Restaurant Rec',
    ai_message: 'AI Message',
    signup_bonus: 'Signup Bonus',
    monthly_free: 'Monthly Free',
    purchase: 'Purchase',
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-primary" />
        <span className="text-sm">{actionLabels[action] || action}</span>
      </div>
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span>{formatNumber(count)} calls</span>
        <span>{formatNumber(credits)} credits</span>
        <span className="font-medium text-foreground">{formatUSD(cost)}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function UnitEconomics() {
  const navigate = useNavigate();
  const { data: metrics, isLoading, error } = useAdminMetrics();
  
  // Simulation slider for projections
  const [simulatedUsers, setSimulatedUsers] = useState(100);

  // Calculate economics based on real data or simulated
  const economics = useMemo(() => {
    if (!metrics) {
      // Simulated data for projection
      const simulatedCreditsPerUser = 500;
      const simulatedCreditsSpent = simulatedUsers * simulatedCreditsPerUser;
      const simulatedRevenue = simulatedUsers * 35; // ~$35 ARPU
      
      return calculateUnitEconomics(
        simulatedCreditsSpent,
        simulatedCreditsSpent,
        simulatedRevenue,
        simulatedUsers,
        {}
      );
    }
    
    return calculateUnitEconomics(
      metrics.totalCreditsSpent,
      metrics.totalCreditsPurchased,
      metrics.totalRevenueFromCredits,
      metrics.activeUsers,
      metrics.activityBreakdown
    );
  }, [metrics, simulatedUsers]);

  // Activity breakdown with costs
  const activityRows = useMemo(() => {
    if (!metrics?.activityBreakdown) return [];
    
    return Object.entries(metrics.activityBreakdown).map(([action, count]) => {
      const credits = (CREDIT_ACTION_COSTS[action as keyof typeof CREDIT_ACTION_COSTS] || 0) * count;
      const cost = (AI_COST_PER_ACTION[action as keyof typeof AI_COST_PER_ACTION] || 0) * count;
      return { action, count, credits, cost };
    }).sort((a, b) => b.credits - a.credits);
  }, [metrics?.activityBreakdown]);

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="border-destructive">
            <CardContent className="p-6">
              <p className="text-destructive">
                {error instanceof Error ? error.message : 'Failed to load admin metrics'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Unit Economics</h1>
                <p className="text-sm text-muted-foreground">
                  Margin analysis & cost tracking
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span>Live data · {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Top Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Revenue"
            value={formatUSD(metrics?.totalRevenueFromCredits || 0)}
            sub="From credit purchases"
            icon={DollarSign}
            trend="up"
          />
          <MetricCard
            label="Gross Margin"
            value={formatPercent(economics.grossMargin)}
            sub={economics.grossMargin >= 80 ? 'Healthy' : 'Needs attention'}
            icon={TrendingUp}
            trend={economics.grossMargin >= 80 ? 'up' : economics.grossMargin >= 50 ? 'neutral' : 'down'}
          />
          <MetricCard
            label="Active Users"
            value={formatNumber(metrics?.activeUsers || 0)}
            sub={`${metrics?.paidUsers || 0} paid`}
            icon={Users}
          />
          <MetricCard
            label="Credits Outstanding"
            value={formatNumber((metrics?.outstandingPurchasedCredits || 0) + (metrics?.outstandingFreeCredits || 0))}
            sub={`${formatNumber(metrics?.outstandingFreeCredits || 0)} free`}
            icon={Coins}
          />
        </div>

        {/* Cost Breakdown + Margin Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary" />
                Cost Structure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-4">
                <p className="text-4xl font-bold text-primary">
                  {formatUSD(economics.totalCost)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Total monthly cost
                </p>
              </div>

              <div className="space-y-4">
                <CostBreakdownBar
                  label="Fixed Costs"
                  value={economics.totalFixed}
                  max={economics.totalCost}
                  color="hsl(var(--chart-1))"
                  amount={formatUSD(economics.totalFixed)}
                />
                <CostBreakdownBar
                  label="AI / Variable Costs"
                  value={economics.totalAICost}
                  max={economics.totalCost}
                  color="hsl(var(--chart-2))"
                  amount={formatUSD(economics.totalAICost)}
                />
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">AI share of costs</span>
                  <span className="font-medium">{formatPercent(economics.aiShare)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cost per credit</span>
                  <span className="font-medium">{formatUSD(economics.costPerCredit, 4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Revenue per credit</span>
                  <span className="font-medium">{formatUSD(economics.revenuePerCredit, 4)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Margin by Pricing Tier */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Margin by Credit Pack
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: 'Top-Up', credits: 50, price: 5, perCredit: 0.10 },
                { name: 'Single', credits: 200, price: 12, perCredit: 0.06 },
                { name: 'Starter', credits: 500, price: 29, perCredit: 0.058 },
                { name: 'Explorer', credits: 1200, price: 55, perCredit: 0.046, featured: true },
                { name: 'Adventurer', credits: 2500, price: 89, perCredit: 0.036 },
              ].map((pack) => {
                // Estimate AI cost per credit based on usage
                const estimatedCostPerCredit = economics.costPerCredit || 0.001;
                const margin = ((pack.perCredit - estimatedCostPerCredit) / pack.perCredit) * 100;
                const profitPerCredit = pack.perCredit - estimatedCostPerCredit;
                
                return (
                  <div 
                    key={pack.name}
                    className={cn(
                      'p-4 rounded-lg border transition-colors',
                      pack.featured ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pack.name}</span>
                        {pack.featured && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            Popular
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        'font-bold',
                        margin >= 90 ? 'text-chart-2' : 
                        margin >= 70 ? 'text-chart-1' : 
                        margin >= 50 ? 'text-chart-4' : 'text-destructive'
                      )}>
                        {formatPercent(margin)}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <div>
                        <p className="font-medium text-foreground">{formatNumber(pack.credits)}</p>
                        <p>credits</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{formatUSD(pack.price)}</p>
                        <p>price</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{formatUSD(pack.perCredit, 3)}</p>
                        <p>/credit</p>
                      </div>
                      <div>
                        <p className="font-medium text-chart-2">{formatUSD(profitPerCredit * pack.credits)}</p>
                        <p>profit</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Activity Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Activity Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityRows.length > 0 ? (
              <div className="divide-y divide-border">
                {activityRows.map((row) => (
                  <ActivityBreakdownRow key={row.action} {...row} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No activity data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fixed Costs Detail */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Fixed Monthly Costs
              </CardTitle>
              <span className="text-sm font-medium">
                {formatUSD(economics.totalFixed)}/mo
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FIXED_COSTS.map((cost) => (
                <div 
                  key={cost.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{cost.name}</p>
                    <p className="text-xs text-muted-foreground">{cost.note}</p>
                  </div>
                  <span className={cn(
                    'text-sm font-medium',
                    cost.cost === 0 ? 'text-chart-2' : 'text-foreground'
                  )}>
                    {cost.cost === 0 ? 'FREE' : formatUSD(cost.cost)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-chart-2/10 border border-chart-2/20">
              <p className="text-xs text-chart-2">
                ✓ Lovable Cloud handles infrastructure · No separate hosting costs
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Scaling Projection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Scaling Economics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Projected Monthly Users</span>
                <span className="font-mono font-medium">{formatNumber(simulatedUsers)}</span>
              </div>
              <Slider
                value={[simulatedUsers]}
                onValueChange={(v) => setSimulatedUsers(v[0])}
                min={10}
                max={1000}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                {[10, 100, 250, 500, 1000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setSimulatedUsers(v)}
                    className={cn(
                      'hover:text-foreground transition-colors',
                      simulatedUsers === v && 'text-primary font-medium'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[10, 50, 100, 500, 1000].map((vol) => {
                const projectedRevenue = vol * 35; // ~$35 ARPU
                const projectedCredits = vol * 500;
                const sim = calculateUnitEconomics(
                  projectedCredits,
                  projectedCredits,
                  projectedRevenue,
                  vol,
                  {}
                );
                const costPerUser = sim.totalCost / vol;
                
                return (
                  <motion.div
                    key={vol}
                    onClick={() => setSimulatedUsers(vol)}
                    className={cn(
                      'p-4 rounded-lg border cursor-pointer transition-all text-center',
                      simulatedUsers === vol 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <p className="text-lg font-bold">{vol}/mo</p>
                    <p className="text-xs text-muted-foreground mb-2">users</p>
                    <p className="text-sm font-medium">{formatUSD(costPerUser)}</p>
                    <p className="text-xs text-muted-foreground">cost/user</p>
                    <p className={cn(
                      'text-lg font-bold mt-2',
                      sim.grossMargin >= 80 ? 'text-chart-2' :
                      sim.grossMargin >= 50 ? 'text-chart-1' :
                      sim.grossMargin >= 0 ? 'text-chart-4' : 'text-destructive'
                    )}>
                      {formatPercent(sim.grossMargin)}
                    </p>
                    <p className="text-xs text-muted-foreground">margin</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-primary mb-1">Key Insight</p>
                <p className="text-xs text-muted-foreground">
                  Fixed costs are minimal due to Lovable Cloud. Variable costs scale linearly 
                  with AI usage at ~$0.001-0.01/credit. Gross margins remain &gt;90% at scale.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-primary mb-1">Bottom Line</p>
                <p className="text-xs text-muted-foreground">
                  Breakeven: ~{economics.breakevenUsers === Infinity ? 'N/A' : economics.breakevenUsers} users.
                  Every user beyond that contributes ~$30+ in pure margin assuming $35 ARPU.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          Prices: Lovable AI (estimated pass-through) · Credit costs from config · {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}
