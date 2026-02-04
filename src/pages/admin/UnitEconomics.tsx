/**
 * Admin Unit Economics Dashboard
 * Tracks margins, credit usage, API costs, and customer metrics
 * Uses accurate cost data from docs/PRICE_SHEET.md
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
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';
import { 
  FIXED_COSTS, 
  TOTAL_FIXED_MONTHLY,
  CREDIT_ACTION_MAPPING,
  REVENUE_CONFIG,
  AI_COSTS,
  USER_LIFECYCLE_COSTS,
  BLENDED_COST_PER_VISITOR,
  calculateUnitEconomics,
  projectCostsForVolume,
  formatUSD,
  formatNumber,
  formatPercent,
  type EconomicsOutput,
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
  costMin,
  costMax,
}: {
  action: string;
  count: number;
  credits: number;
  costMin: number;
  costMax: number;
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

  const avgCost = (costMin + costMax) / 2 * count;

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-primary" />
        <span className="text-sm">{actionLabels[action] || action}</span>
      </div>
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span>{formatNumber(count)} calls</span>
        <span>{formatNumber(credits)} credits</span>
        <span className="font-medium text-foreground">
          {formatUSD(avgCost, 2)}
        </span>
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
  const economics: EconomicsOutput = useMemo(() => {
    if (metrics) {
      return calculateUnitEconomics({
        creditsSpent: metrics.totalCreditsSpent,
        creditsPurchased: metrics.totalCreditsPurchased,
        revenueFromPurchases: metrics.totalRevenueFromCredits,
        totalUsers: metrics.totalUsers,
        paidUsers: metrics.paidUsers,
        activityCounts: metrics.activityBreakdown,
      });
    }
    
    // Use projection for demo
    return projectCostsForVolume(simulatedUsers);
  }, [metrics, simulatedUsers]);

  // Activity breakdown with costs
  const activityRows = useMemo(() => {
    if (!metrics?.activityBreakdown) return [];
    
    return Object.entries(metrics.activityBreakdown).map(([action, count]) => {
      const mapping = CREDIT_ACTION_MAPPING[action as keyof typeof CREDIT_ACTION_MAPPING];
      const credits = mapping ? mapping.credits * count : 0;
      const costMin = mapping?.costMin || 0;
      const costMax = mapping?.costMax || 0;
      return { action, count, credits, costMin, costMax };
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
        {/* Data Source Warning */}
        {!metrics && (
          <Card className="border-chart-4/50 bg-chart-4/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-chart-4" />
              <div>
                <p className="text-sm font-medium">Using Projected Data</p>
                <p className="text-xs text-muted-foreground">
                  No transaction data found. Showing projections for {simulatedUsers} users.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Gross Revenue"
            value={formatUSD(economics.grossRevenue)}
            sub={`Net: ${formatUSD(economics.netRevenue)} after Stripe`}
            icon={DollarSign}
            trend={economics.grossRevenue > 0 ? 'up' : 'neutral'}
          />
          <MetricCard
            label="Gross Margin"
            value={formatPercent(economics.grossMarginPercent)}
            sub={economics.grossMarginPercent >= 80 ? 'Healthy' : 'Needs attention'}
            icon={TrendingUp}
            trend={economics.grossMarginPercent >= 80 ? 'up' : economics.grossMarginPercent >= 50 ? 'neutral' : 'down'}
          />
          <MetricCard
            label="Total Monthly Cost"
            value={formatUSD(economics.totalMonthlyCost)}
            sub={`Fixed: ${formatUSD(economics.fixedCostsMonthly)}`}
            icon={CreditCard}
          />
          <MetricCard
            label="Active Users"
            value={formatNumber(metrics?.activeUsers || simulatedUsers)}
            sub={`${metrics?.paidUsers || Math.ceil(simulatedUsers * 0.1)} paid`}
            icon={Users}
          />
        </div>

        {/* Cost Breakdown + Revenue Analysis */}
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
                  {formatUSD(economics.totalMonthlyCost)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Total monthly cost
                </p>
              </div>

              <div className="space-y-4">
                {economics.costBreakdown.map((item, i) => (
                  <CostBreakdownBar
                    key={item.category}
                    label={item.category}
                    value={item.amount}
                    max={economics.totalMonthlyCost}
                    color={`hsl(var(--chart-${(i % 5) + 1}))`}
                    amount={formatUSD(item.amount)}
                  />
                ))}
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cost per paid user</span>
                  <span className="font-medium">{formatUSD(economics.costPerPaidUser)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cost per credit spent</span>
                  <span className="font-medium">{formatUSD(economics.costPerCredit, 4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Stripe fees</span>
                  <span className="font-medium">{formatUSD(economics.stripeFees)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Margin by Credit Pack */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Margin by Credit Pack
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(REVENUE_CONFIG.creditPacks).map(([key, pack]) => {
                const perCredit = pack.price / pack.credits;
                // Estimate cost per credit (midpoint of activity costs)
                const avgCostPerCredit = economics.costPerCredit || 0.002;
                const marginPerCredit = perCredit - avgCostPerCredit;
                const marginPercent = (marginPerCredit / perCredit) * 100;
                const profitPerPack = marginPerCredit * pack.credits;
                const stripeFee = pack.price * 0.029 + 0.30;
                const netProfit = profitPerPack - stripeFee;
                
                return (
                  <div 
                    key={key}
                    className={cn(
                      'p-4 rounded-lg border transition-colors',
                      key === 'explorer' ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{key}</span>
                        {key === 'explorer' && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            Popular
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        'font-bold',
                        marginPercent >= 90 ? 'text-chart-2' : 
                        marginPercent >= 70 ? 'text-chart-1' : 
                        marginPercent >= 50 ? 'text-chart-4' : 'text-destructive'
                      )}>
                        {formatPercent(marginPercent)}
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
                        <p className="font-medium text-foreground">{formatUSD(perCredit, 3)}</p>
                        <p>/credit</p>
                      </div>
                      <div>
                        <p className="font-medium text-chart-2">{formatUSD(netProfit)}</p>
                        <p>net profit</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Activity Breakdown */}
        {activityRows.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Activity Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {activityRows.map((row) => (
                  <ActivityBreakdownRow key={row.action} {...row} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Lifecycle Costs - NEW */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                User Lifecycle Costs
              </CardTitle>
              <span className="text-sm">
                Blended: <span className="font-medium text-primary">{formatUSD(BLENDED_COST_PER_VISITOR)}</span>/visitor
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {Object.entries(USER_LIFECYCLE_COSTS).map(([key, data]) => {
                const avgCost = (data.min + data.max) / 2;
                const isHighCost = avgCost > 1;
                
                return (
                  <div 
                    key={key}
                    className={cn(
                      'p-4 rounded-lg border text-center',
                      isHighCost ? 'border-chart-4/50 bg-chart-4/5' : 'border-border bg-muted/30'
                    )}
                  >
                    <p className="text-xs text-muted-foreground capitalize mb-1">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className={cn(
                      'text-lg font-bold',
                      isHighCost ? 'text-chart-4' : 'text-foreground'
                    )}>
                      {formatUSD(data.min)} - {formatUSD(data.max)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{data.desc}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <strong className="text-foreground">Distribution:</strong> 60% bounce ($0.002 avg), 25% free users ($0.10 avg), 
              10% single purchase ($0.78 avg), 4% repeat ($2.16 avg), 1% power ($7.25 avg)
            </div>
          </CardContent>
        </Card>

        {/* AI Feature Costs - NEW */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              AI Feature Costs (Lovable AI Gateway)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(AI_COSTS.features).map(([key, feature]) => (
                <div 
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{feature.desc}</p>
                    <p className="text-xs text-muted-foreground">{feature.model}</p>
                  </div>
                  <span className="text-sm font-mono font-medium ml-2 whitespace-nowrap">
                    ${feature.min.toFixed(3)} - ${feature.max.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
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
                {formatUSD(TOTAL_FIXED_MONTHLY)}/mo
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
                const sim = projectCostsForVolume(vol);
                const costPerUser = sim.totalMonthlyCost / (sim.grossRevenue > 0 ? Math.ceil(vol * 0.1) : 1);
                
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
                    <p className="text-sm font-medium">{formatUSD(sim.totalMonthlyCost)}</p>
                    <p className="text-xs text-muted-foreground">total cost</p>
                    <p className={cn(
                      'text-lg font-bold mt-2',
                      sim.grossMarginPercent >= 80 ? 'text-chart-2' :
                      sim.grossMarginPercent >= 50 ? 'text-chart-1' :
                      sim.grossMarginPercent >= 0 ? 'text-chart-4' : 'text-destructive'
                    )}>
                      {formatPercent(sim.grossMarginPercent)}
                    </p>
                    <p className="text-xs text-muted-foreground">margin</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-primary mb-1">Cost Structure</p>
                <p className="text-xs text-muted-foreground">
                  Fixed: {formatUSD(TOTAL_FIXED_MONTHLY)}/mo (Lovable $25 + Domain ~$4).
                  Variable scales with AI usage at ~$0.01-0.04 per action.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-primary mb-1">Break-Even</p>
                <p className="text-xs text-muted-foreground">
                  At 10% conversion, need ~{Math.ceil(TOTAL_FIXED_MONTHLY / 3.5)} users to cover fixed costs 
                  (assuming ~$35 ARPU).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          Data source: docs/PRICE_SHEET.md · Lovable AI Gateway pricing · {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}
