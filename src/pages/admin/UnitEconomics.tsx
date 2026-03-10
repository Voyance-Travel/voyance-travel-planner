/**
 * Admin Business Dashboard — Multi-tab Light UI
 * Route: /admin/dashboard (redirected from /admin/margins)
 */

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, LayoutDashboard, DollarSign, TrendingDown, Users, Coins, LineChart, Settings, AlertTriangle, CheckCircle2, ArrowLeft, TrendingUp, CircleDollarSign } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useUnitEconomicsData, type UnitEconomicsData } from "@/hooks/useUnitEconomicsData";

// ============================================================================
// Constants (preserved from original)
// ============================================================================

const FREE_USER_ECONOMICS = {
  recurringCostPerMonth: 0.024,
  acquisitionCostBlended: 0.278,
};

const ACTION_COSTS: Record<string, number> = {
  unlock_day: 0.018, day_unlock: 0.018, swap_activity: 0.009,
  regenerate_day: 0.018, restaurant_rec: 0.015, ai_message: 0.005,
  hotel_search: 0.020, smart_finish: 0.040, purchase_smart_finish: 0.040,
  group_unlock: 0.50, purchase_group_small: 0.50, purchase_group_medium: 1.00,
  purchase_group_large: 1.50, mystery_getaway: 0.025, mystery_logistics: 0.015,
  transport_mode_change: 0.005, route_optimization: 0.015,
};

const KNOWN_PACK_PRICES: Record<string, number> = {
  flex_100: 9, flex_300: 25, flex_500: 39,
  voyager: 49.99, explorer: 89.99, adventurer: 149.99,
};

// ============================================================================
// Tab definitions
// ============================================================================

type TabKey = 'overview' | 'revenue' | 'costs' | 'users' | 'credits' | 'forecast' | 'projections' | 'credit-economics';

const TABS: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'revenue', label: 'Revenue', icon: DollarSign },
  { key: 'costs', label: 'Costs', icon: TrendingDown },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'credits', label: 'Credits', icon: Coins },
  { key: 'forecast', label: 'Forecast', icon: LineChart },
  { key: 'projections', label: 'Projections', icon: TrendingUp },
  { key: 'credit-economics', label: 'Credit Econ', icon: CircleDollarSign },
];

// ============================================================================
// Revenue Mix Presets
// ============================================================================

const REVENUE_MIX_PRESETS = {
  pessimistic: { label: 'Pessimistic', description: 'Most users buy cheapest pack', flex_100: 80, flex_300: 10, flex_500: 5, voyager: 3, explorer: 2, adventurer: 0 },
  conservative: { label: 'Conservative', description: 'Skewed toward smaller packs', flex_100: 40, flex_300: 25, flex_500: 15, voyager: 10, explorer: 7, adventurer: 3 },
  balanced: { label: 'Balanced', description: 'Even spread across tiers', flex_100: 20, flex_300: 20, flex_500: 20, voyager: 15, explorer: 15, adventurer: 10 },
  optimistic: { label: 'Optimistic', description: 'Higher-value packs dominate', flex_100: 10, flex_300: 15, flex_500: 15, voyager: 20, explorer: 25, adventurer: 15 },
} as const;

type MixKey = keyof typeof REVENUE_MIX_PRESETS;

const CREDIT_TIERS = [
  { key: 'flex_100', label: 'Flex 100', price: 9, credits: 100, color: 'hsl(var(--primary))' },
  { key: 'flex_300', label: 'Flex 300', price: 25, credits: 300, color: 'hsl(var(--primary))' },
  { key: 'flex_500', label: 'Flex 500', price: 39, credits: 500, color: 'hsl(var(--primary))' },
  { key: 'voyager', label: 'Voyager', price: 49.99, credits: 600, color: 'hsl(var(--accent))' },
  { key: 'explorer', label: 'Explorer', price: 89.99, credits: 1600, color: 'hsl(var(--accent))' },
  { key: 'adventurer', label: 'Adventurer', price: 149.99, credits: 3200, color: 'hsl(var(--accent))' },
];

const CREDIT_ACTIONS = [
  { action: 'Unlock Full Day', credits: 60, cost: 0.018, freeCap: '—', category: 'core', what: 'Reveals addresses, photos, hours, tips, booking links' },
  { action: 'Smart Finish', credits: 50, cost: 0.040, freeCap: '—', category: 'core', what: 'AI enrichment for manual/imported trips' },
  { action: 'Hotel Search', credits: 40, cost: 0.020, freeCap: '—', category: 'core', what: 'AI hotel suggestions per city' },
  { action: 'Route Optimization', credits: 20, cost: 0.015, freeCap: '—', category: 'core', what: 'Google Routes + AI reorder per day' },
  { action: 'Mystery Getaway', credits: 15, cost: 0.025, freeCap: '—', category: 'discovery', what: 'AI surprise destination suggestions' },
  { action: 'Regenerate Day', credits: 10, cost: 0.018, freeCap: '1-5/trip', category: 'editing', what: 'Full day regeneration with new venues' },
  { action: 'Swap Activity', credits: 5, cost: 0.009, freeCap: '3-15/trip', category: 'editing', what: 'Replace one activity with alternative' },
  { action: 'Add Activity', credits: 5, cost: 0.009, freeCap: '2-10/trip', category: 'editing', what: 'Add new activity to a day' },
  { action: 'Restaurant Rec', credits: 5, cost: 0.015, freeCap: '1-5/trip', category: 'dining', what: 'Perplexity-powered restaurant suggestion' },
  { action: 'AI Companion', credits: 5, cost: 0.005, freeCap: '5-25/trip', category: 'chat', what: 'Chat message with AI trip companion' },
  { action: 'Mystery Logistics', credits: 5, cost: 0.015, freeCap: '—', category: 'discovery', what: 'Flight + hotel estimates for mystery trip' },
  { action: 'Transport Mode', credits: 5, cost: 0.005, freeCap: '—', category: 'routing', what: 'Change transport mode for a route' },
];

const TIER_RATES = [
  { rate: 9 / 100, label: 'Flex 100', perCr: '$0.090/cr' },
  { rate: 39 / 500, label: 'Flex 500', perCr: '$0.078/cr' },
  { rate: 89.99 / 1600, label: 'Explorer', perCr: '$0.056/cr' },
  { rate: 149.99 / 3200, label: 'Adventurer', perCr: '$0.047/cr' },
];

// ============================================================================
// Helpers
// ============================================================================

function fmt$(n: number, decimals = 2): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: 'green' | 'red' | 'amber' | 'teal' | 'default' }) {
  const borderColors = {
    green: 'border-t-emerald-500',
    red: 'border-t-red-500',
    amber: 'border-t-amber-500',
    teal: 'border-t-primary',
    default: 'border-t-border',
  };
  return (
    <Card className={cn("border-t-4", borderColors[accent || 'default'])}>
      <CardContent className="p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Tab: Overview
// ============================================================================

function OverviewTab({ data }: { data: UnitEconomicsData }) {
  const netPosition = data.revenue.totalRevenue - data.costs.totalCost;
  const margin = data.revenue.totalRevenue > 0 ? (netPosition / data.revenue.totalRevenue) * 100 : 0;
  const avgCostPerTrip = data.trips.totalTrips > 0 ? data.costs.totalCost / data.trips.totalTrips : 0;
  const conversionRate = data.users.totalUsers > 0 ? (data.users.paidUsers / data.users.totalUsers) * 100 : 0;

  // Worst-case liability: if every outstanding credit triggers API cost
  const avgCostPerCreditSpend = data.revenue.totalCreditsSpent > 0
    ? data.costs.totalCost / data.revenue.totalCreditsSpent
    : 0.01;
  const worstCaseCost = (data.users.outstandingPurchased + data.users.outstandingFree) * avgCostPerCreditSpend;

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Money In"
          value={data.revenue.totalRevenue > 0 ? fmt$(data.revenue.totalRevenue) : '-'}
          sub={data.revenue.purchaseCount > 0
            ? `${data.revenue.purchaseCount} purchases from ${data.users.paidUsers} customers`
            : 'No purchases recorded yet'}
          accent="green"
        />
        <MetricCard
          label="Money Out (30d)"
          value={fmt$(data.costs.totalCost)}
          sub={`${fmt$(avgCostPerTrip)} avg per trip · ${data.trips.totalTrips} trips tracked`}
          accent="amber"
        />
        <MetricCard
          label="Net Position"
          value={`${netPosition >= 0 ? '' : '-'}${fmt$(Math.abs(netPosition))}`}
          sub={data.revenue.totalRevenue > 0 ? `${fmtPct(margin)} margin` : 'No revenue yet'}
          accent={netPosition >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* User line */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground px-1">
        <span><strong className="text-foreground">{data.users.totalUsers}</strong> total users</span>
        <span>·</span>
        <span><strong className="text-foreground">{data.users.paidUsers}</strong> paid ({fmtPct(conversionRate)} conversion)</span>
        <span>·</span>
        <span><strong className="text-foreground">{data.trips.totalTrips}</strong> trips created</span>
      </div>

      {/* Credit health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-serif">Outstanding Credits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Purchased credits: </span>
              <span className="font-mono font-semibold text-foreground">{data.users.outstandingPurchased.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Free credits: </span>
              <span className="font-mono font-semibold text-foreground">{data.users.outstandingFree.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            If every outstanding credit gets used → worst-case API cost: <span className="font-mono font-semibold">{fmt$(worstCaseCost)}</span>
            <span className="ml-1">(based on {fmt$(avgCostPerCreditSpend, 4)} avg cost per credit-spend)</span>
          </p>
        </CardContent>
      </Card>

      {/* Data health */}
      {data.dataQuality.warnings.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Data mismatch detected</p>
            {data.dataQuality.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700 mt-1">{w}</p>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700">All systems healthy</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tab: Revenue
// ============================================================================

function RevenueTab({ data }: { data: UnitEconomicsData }) {
  return (
    <div className="space-y-6">
      {/* Tier breakdown */}
      {data.revenue.tiers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-serif">Revenue by Pack Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {data.revenue.tiers.map((tier) => (
                <div key={tier.tier} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-sm font-semibold capitalize text-foreground">{tier.tier.replace(/_/g, ' ')}</p>
                  <p className="text-lg font-mono font-bold text-primary">{fmt$(tier.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">
                    {tier.count} purchase{tier.count !== 1 ? 's' : ''} · {tier.totalCredits.toLocaleString()} credits
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purchase history table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-serif">Purchase History</CardTitle>
          <CardDescription>{data.revenue.userPurchases.length} paying user{data.revenue.userPurchases.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.revenue.userPurchases.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No purchases recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Purchases</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Packs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.revenue.userPurchases.map((up) => {
                  const packSummary = up.purchases.reduce((acc, p) => {
                    acc[p.tier] = (acc[p.tier] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);
                  return (
                    <TableRow key={up.userId}>
                      <TableCell className="font-medium">
                        {up.displayName}
                        <span className="ml-2 text-xs text-muted-foreground">{up.userId.slice(0, 8)}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono">{up.purchaseCount}</TableCell>
                      <TableCell className="text-right font-mono">{up.totalCredits.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">{fmt$(up.totalRevenue)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(packSummary).map(([tier, count]) => (
                            <Badge key={tier} variant="secondary" className="text-[10px] capitalize">
                              {tier.replace(/_/g, ' ')} ×{count}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Tab: Costs
// ============================================================================

function CostsTab({ data }: { data: UnitEconomicsData }) {
  return (
    <div className="space-y-6">
      {/* Cost by provider */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-serif">Cost by API Provider</CardTitle>
          <CardDescription>Last 30 days · {data.costs.totalEntries} tracked entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { label: 'Google (Places, Geocoding, Photos, Routes)', cost: data.costs.google.cost, calls: data.costs.google.calls },
              { label: 'AI (Gemini models)', cost: data.costs.ai.cost, calls: data.costs.ai.calls },
              { label: 'Perplexity (Sonar)', cost: data.costs.perplexity.cost, calls: data.costs.perplexity.calls },
              { label: 'Amadeus', cost: data.costs.amadeus.cost, calls: data.costs.amadeus.calls },
            ].filter(s => s.cost > 0 || s.calls > 0).map((s) => {
              const pct = data.costs.totalCost > 0 ? (s.cost / data.costs.totalCost) * 100 : 0;
              return (
                <div key={s.label}>
                  <div className="flex justify-between items-baseline text-sm mb-1">
                    <span className="text-foreground font-medium">{s.label}</span>
                    <span className="font-mono text-foreground">{fmt$(s.cost)} <span className="text-muted-foreground text-xs">({fmtPct(pct)})</span></span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(pct, 1)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.calls.toLocaleString()} calls</p>
                </div>
              );
            })}
            <div className="flex justify-between items-baseline text-sm font-semibold pt-3 border-t">
              <span>Total</span>
              <span className="font-mono">{fmt$(data.costs.totalCost)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost by category */}
      {data.costs.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-serif">Cost by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.costs.categories.map((cat) => (
                  <TableRow key={cat.category}>
                    <TableCell className="font-medium">{cat.label}</TableCell>
                    <TableCell className="text-right font-mono">{cat.count}</TableCell>
                    <TableCell className="text-right font-mono">{fmt$(cat.cost)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {data.costs.totalCost > 0 ? fmtPct((cat.cost / data.costs.totalCost) * 100) : '0%'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Cost by AI model */}
      {Object.keys(data.costs.models).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-serif">AI Model Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Input Tokens</TableHead>
                  <TableHead className="text-right">Output Tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(data.costs.models)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([model, m]) => (
                    <TableRow key={model}>
                      <TableCell className="font-mono text-xs">{model}</TableCell>
                      <TableCell className="text-right font-mono">{m.count.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">{m.inputTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">{m.outputTokens.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Tab: Users
// ============================================================================

function UsersTab({ data }: { data: UnitEconomicsData }) {
  const conversionRate = data.users.totalUsers > 0 ? (data.users.paidUsers / data.users.totalUsers) * 100 : 0;
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Users" value={`${data.users.totalUsers}`} sub="From profiles" accent="teal" />
        <MetricCard label="Paid Users" value={`${data.users.paidUsers}`} sub={`${fmtPct(conversionRate)} conversion`} accent="green" />
        <MetricCard label="With Balance" value={`${data.users.usersWithBalance}`} sub="Have credit balance" accent="default" />
        <MetricCard label="API Active" value={`${data.users.activeApiUsers}`} sub="Triggered API calls" accent="amber" />
      </div>

      {/* Tier distribution */}
      {data.tierDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-serif">User Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Upgraded This Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const total = data.tierDistribution.reduce((s, t) => s + t.count, 0);
                  return data.tierDistribution.map(t => (
                    <TableRow key={t.tier}>
                      <TableCell className="font-medium capitalize">{t.tier}</TableCell>
                      <TableCell className="text-right font-mono">{t.count.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{total > 0 ? fmtPct((t.count / total) * 100) : '0%'}</TableCell>
                      <TableCell className="text-right font-mono">
                        {t.tier === 'free' ? '—' : <span className={t.upgradedThisMonth > 0 ? 'text-primary' : 'text-muted-foreground'}>+{t.upgradedThisMonth}</span>}
                      </TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Tab: Credits
// ============================================================================

function CreditsTab({ data }: { data: UnitEconomicsData }) {
  const totalOutstanding = data.users.outstandingPurchased + data.users.outstandingFree;
  const avgCostPerCreditSpend = data.revenue.totalCreditsSpent > 0
    ? data.costs.totalCost / data.revenue.totalCreditsSpent
    : 0.01;
  const worstCaseCost = totalOutstanding * avgCostPerCreditSpend;
  const bestCaseCost = data.users.outstandingPurchased * avgCostPerCreditSpend; // free credits may expire

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Purchased Outstanding" value={data.users.outstandingPurchased.toLocaleString()} sub="Never expire (Stripe-backed)" accent="green" />
        <MetricCard label="Free Outstanding" value={data.users.outstandingFree.toLocaleString()} sub="Expire after 2 months" accent="amber" />
        <MetricCard label="Total Spent" value={data.revenue.totalCreditsSpent.toLocaleString()} sub={`Across ${Object.keys(data.revenue.spendByAction).length} action types`} accent="teal" />
      </div>

      {/* Worst/best case */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-serif">Liability Scenarios</CardTitle>
          <CardDescription>If outstanding credits are all consumed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-red-50/50 p-4">
              <p className="text-xs font-medium text-red-700 uppercase tracking-wider">Worst Case</p>
              <p className="text-xl font-mono font-bold text-red-700 mt-1">{fmt$(worstCaseCost)}</p>
              <p className="text-xs text-red-600 mt-1">
                All {totalOutstanding.toLocaleString()} credits consumed at {fmt$(avgCostPerCreditSpend, 4)}/credit avg cost
              </p>
            </div>
            <div className="rounded-lg border bg-emerald-50/50 p-4">
              <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Best Case</p>
              <p className="text-xl font-mono font-bold text-emerald-700 mt-1">{fmt$(bestCaseCost)}</p>
              <p className="text-xs text-emerald-600 mt-1">
                Only purchased credits ({data.users.outstandingPurchased.toLocaleString()}) used; free credits expire
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit consumption by action */}
      {Object.keys(data.revenue.spendByAction).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-serif">Credit Consumption by Action</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Uses</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Avg/Use</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(data.revenue.spendByAction)
                  .sort(([, a], [, b]) => b.credits - a.credits)
                  .map(([action, d]) => {
                    const costPerUse = ACTION_COSTS[action] || 0.01;
                    const estCost = d.count * costPerUse;
                    const avg = d.count > 0 ? (d.credits / d.count).toFixed(1) : '0';
                    return (
                      <TableRow key={action}>
                        <TableCell className="font-medium capitalize">{action.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right font-mono">{d.count}</TableCell>
                        <TableCell className="text-right font-mono">{d.credits.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{avg}</TableCell>
                        <TableCell className="text-right font-mono">{fmt$(estCost, 3)}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Group budgets */}
      {data.groupBudgets.totalPools > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-serif">Group Budget Pools</CardTitle>
            <CardDescription>{data.groupBudgets.totalPools} active pools</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Pools</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Utilization</TableHead>
                  <TableHead className="text-right">Depleted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.groupBudgets.pools.map(p => {
                  const util = p.allocated > 0 ? ((p.allocated - p.remaining) / p.allocated * 100) : 0;
                  return (
                    <TableRow key={p.tier}>
                      <TableCell className="font-medium capitalize">{p.tier}</TableCell>
                      <TableCell className="text-right font-mono">{p.count}</TableCell>
                      <TableCell className="text-right font-mono">{p.allocated.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">{p.remaining.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">{fmtPct(util)}</TableCell>
                      <TableCell className={cn("text-right font-mono", p.depleted > 0 && "text-destructive font-semibold")}>{p.depleted}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Tab: Forecast
// ============================================================================

function ForecastTab({ data }: { data: UnitEconomicsData }) {
  // Calculate projection rates from current data
  const daysOfData = data.dataQuality.costDataDays || 30;
  const dailyRevenue = data.revenue.totalRevenue / Math.max(daysOfData, 1);
  const dailyCost = data.costs.totalCost / Math.max(daysOfData, 1);
  const dailyTrips = data.trips.totalTrips / Math.max(daysOfData, 1);
  const monthlyRevenue = dailyRevenue * 30;
  const monthlyCost = dailyCost * 30 + 49; // add fixed costs
  const monthlyTrips = dailyTrips * 30;
  const avgCostPerTrip = data.trips.totalTrips > 0 ? data.costs.totalCost / data.trips.totalTrips : 0.091;

  const scenarioCards = [
    {
      title: '10 Explorer packs this month',
      revenue: 10 * 89.99,
      cost: 10 * 0.54,
      color: 'emerald' as const,
    },
    {
      title: 'Trip volume doubles',
      revenue: monthlyRevenue, // same revenue (trips ≠ purchases)
      cost: monthlyCost + (monthlyTrips * avgCostPerTrip),
      color: 'amber' as const,
    },
    {
      title: '50 Flex 300 packs this month',
      revenue: 50 * 25,
      cost: 50 * 0.09,
      color: 'teal' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Projections based on current {daysOfData}-day data window. Clearly labeled as <strong>estimates</strong> — linear extrapolation from current trends.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Projected Monthly Revenue"
          value={monthlyRevenue > 0 ? fmt$(monthlyRevenue) : '—'}
          sub={`At current rate of ${fmt$(dailyRevenue)}/day`}
          accent="green"
        />
        <MetricCard
          label="Projected Monthly Cost"
          value={fmt$(monthlyCost)}
          sub={`Variable ${fmt$(monthlyCost - 49)} + Fixed $49`}
          accent="amber"
        />
        <MetricCard
          label="Current Burn Rate"
          value={fmt$(monthlyCost)}
          sub={`${fmt$(monthlyCost / 30)}/day in API + infra`}
          accent="red"
        />
      </div>

      {/* Break-even analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-serif">Break-Even Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            // Average revenue per purchase
            const avgRevPerPurchase = data.revenue.purchaseCount > 0
              ? data.revenue.totalRevenue / data.revenue.purchaseCount
              : 50; // estimate
            const purchasesNeeded = monthlyCost > 0 ? Math.ceil(monthlyCost / avgRevPerPurchase) : 0;
            return (
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  At <span className="font-mono font-semibold">{fmt$(avgRevPerPurchase)}</span> average per purchase,
                  you need <span className="font-mono font-semibold text-primary">{purchasesNeeded} purchases/month</span> to
                  cover {fmt$(monthlyCost)}/mo in costs.
                </p>
                <p className="text-xs text-muted-foreground">
                  Current rate: {data.revenue.purchaseCount} purchases over {daysOfData} days = ~{(data.revenue.purchaseCount / daysOfData * 30).toFixed(1)}/month
                </p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Scenario cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarioCards.map((s) => {
          const net = s.revenue - s.cost;
          return (
            <Card key={s.title}>
              <CardContent className="p-5">
                <p className="text-sm font-medium text-foreground mb-3">{s.title}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-mono font-semibold text-primary">{fmt$(s.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API Cost</span>
                    <span className="font-mono">{fmt$(s.cost)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t">
                    <span className="font-medium">Net</span>
                    <span className={cn("font-mono font-semibold", net >= 0 ? "text-primary" : "text-destructive")}>{fmt$(net)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Tab: Projections
// ============================================================================

function ProjectionsTab({ data }: { data: UnitEconomicsData }) {
  const [convRate, setConvRate] = useState(5);
  const [mixKey, setMixKey] = useState<MixKey>('conservative');
  const targets = [100, 500, 1000, 5000, 10000];

  const mix = REVENUE_MIX_PRESETS[mixKey];

  const aov = useMemo(() => {
    return CREDIT_TIERS.reduce((sum, t) => {
      const pct = (mix as any)[t.key] as number || 0;
      return sum + (pct / 100) * t.price;
    }, 0);
  }, [mix]);

  const computeRow = (users: number) => {
    const paid = users * (convRate / 100);
    const free = users - paid;
    const monthlyRevenue = paid * aov;
    const annualRevenue = monthlyRevenue * 12;
    const freeCost = free * FREE_USER_ECONOMICS.recurringCostPerMonth;
    const paidCost = paid * 0.091;
    const totalCost = freeCost + paidCost + 49;
    const monthlyProfit = monthlyRevenue - totalCost;
    const annualProfit = monthlyProfit * 12;
    const margin = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : -100;
    return { paid, free, monthlyRevenue, annualRevenue, totalCost, monthlyProfit, annualProfit, margin };
  };

  const revenuePerUser = aov * (convRate / 100);
  const costPerUser = (convRate / 100) * 0.091 + (1 - convRate / 100) * FREE_USER_ECONOMICS.recurringCostPerMonth;
  const netPerUser = revenuePerUser - costPerUser;
  const breakEvenUsers = netPerUser > 0 ? Math.ceil(49 / netPerUser) : Infinity;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Revenue Projection Model
          </CardTitle>
          <CardDescription>Model revenue at different user volumes, conversion rates, and purchase mixes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Conversion + Mix controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conversion Rate</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-primary">{convRate}</span>
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Slider value={[convRate]} onValueChange={([v]) => setConvRate(v)} min={1} max={50} step={1} />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue Mix</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(REVENUE_MIX_PRESETS) as MixKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setMixKey(k)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                      mixKey === k
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "text-muted-foreground border-border hover:border-primary/20"
                    )}
                  >
                    {REVENUE_MIX_PRESETS[k].label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{mix.description}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Blended AOV</p>
              <p className="text-2xl font-bold font-mono text-primary">{fmt$(aov)}</p>
              <p className="text-xs text-muted-foreground">Average order value from mix</p>
            </div>
          </div>

          {/* Projection Table */}
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Monthly Users</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs text-right">Monthly Rev</TableHead>
                  <TableHead className="text-xs text-right">Annual Rev</TableHead>
                  <TableHead className="text-xs text-right">Total Cost</TableHead>
                  <TableHead className="text-xs text-right">Monthly Profit</TableHead>
                  <TableHead className="text-xs text-right">Annual Profit</TableHead>
                  <TableHead className="text-xs text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((users) => {
                  const r = computeRow(users);
                  return (
                    <TableRow key={users}>
                      <TableCell className="font-medium">{users.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.paid.toFixed(0)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt$(r.monthlyRevenue, 0)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt$(r.annualRevenue, 0)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-destructive">-{fmt$(r.totalCost, 0)}</TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-semibold", r.monthlyProfit >= 0 ? "text-primary" : "text-destructive")}>
                        {r.monthlyProfit >= 0 ? '' : '-'}{fmt$(Math.abs(r.monthlyProfit), 0)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs", r.annualProfit >= 0 ? "text-primary" : "text-destructive")}>
                        {r.annualProfit >= 0 ? '' : '-'}{fmt$(Math.abs(r.annualProfit), 0)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-semibold",
                        r.margin >= 50 ? "text-primary" : r.margin >= 0 ? "text-amber-500" : "text-destructive"
                      )}>
                        {r.margin.toFixed(0)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Mix Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Mix Breakdown</CardTitle>
          <CardDescription>At the "{mix.label}" mix — what are people purchasing?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CREDIT_TIERS.map((tier) => {
              const pct = (mix as any)[tier.key] as number || 0;
              const examplePaid = 1000 * (convRate / 100);
              const revenue = examplePaid * (pct / 100) * tier.price;
              return (
                <div key={tier.key} className={cn("rounded-lg border p-3 space-y-1", pct > 15 ? "bg-primary/5 border-primary/20" : "bg-muted/30")}>
                  <p className="text-xs font-medium text-foreground">{tier.label}</p>
                  <p className="text-lg font-bold font-mono text-primary">{pct}%</p>
                  <p className="text-[10px] text-muted-foreground">{fmt$(tier.price)} × {tier.credits}cr</p>
                  <p className="text-[10px] text-muted-foreground">@1K: {fmt$(revenue, 0)}/mo</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Break-even" value={breakEvenUsers === Infinity ? '∞' : `${breakEvenUsers.toLocaleString()} users`} sub="To cover $49 fixed cost" accent="teal" />
        <MetricCard label="$1K MRR needs" value={revenuePerUser > 0 ? `${Math.ceil(1000 / revenuePerUser).toLocaleString()} users` : '∞'} sub="Monthly recurring target" accent="green" />
        <MetricCard label="Revenue @ 1K users" value={fmt$(computeRow(1000).monthlyRevenue, 0) + '/mo'} sub={`${convRate}% conversion`} accent="green" />
        <MetricCard label="Revenue @ 10K users" value={fmt$(computeRow(10000).monthlyRevenue, 0) + '/mo'} sub={`${convRate}% conversion`} accent="green" />
      </div>
    </div>
  );
}

// ============================================================================
// Tab: Credit Economics
// ============================================================================

function CreditEconomicsTab({ data }: { data: UnitEconomicsData }) {
  const categoryColors: Record<string, string> = {
    core: 'bg-sky-500/10 text-sky-600', editing: 'bg-violet-500/10 text-violet-600',
    dining: 'bg-amber-500/10 text-amber-600', chat: 'bg-emerald-500/10 text-emerald-600',
    discovery: 'bg-orange-500/10 text-orange-600', routing: 'bg-slate-500/10 text-slate-600',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-primary" />
            Complete Credit Economics
          </CardTitle>
          <CardDescription>Every credit action: what it costs us, what users pay, and margins across pricing tiers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs min-w-[180px]">Action</TableHead>
                  <TableHead className="text-xs text-right">Credits</TableHead>
                  <TableHead className="text-xs text-right">Free Cap</TableHead>
                  <TableHead className="text-xs text-right">Our Cost</TableHead>
                  <TableHead className="text-xs text-right">Cost/Cr</TableHead>
                  {TIER_RATES.map((t) => (
                    <TableHead key={t.label} className="text-xs text-right">
                      <div>{t.label}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{t.perCr}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-xs text-right">Best Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CREDIT_ACTIONS.map((row) => {
                  const costPerCr = row.credits > 0 ? row.cost / row.credits : 0;
                  const margins = TIER_RATES.map((t) => {
                    const userPays = row.credits * t.rate;
                    const margin = userPays > 0 ? ((userPays - row.cost) / userPays) * 100 : -100;
                    return { userPays, margin };
                  });
                  const best = Math.max(...margins.map((m) => m.margin));

                  return (
                    <TableRow key={row.action}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", categoryColors[row.category] || '')}>
                            {row.category}
                          </Badge>
                          <div>
                            <p className="text-xs font-medium text-foreground">{row.action}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">{row.what}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">{row.credits}</TableCell>
                      <TableCell className="text-right text-xs">
                        {row.freeCap !== '—' ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5">{row.freeCap}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-destructive">{fmt$(row.cost, 3)}</TableCell>
                      <TableCell className="text-right font-mono text-[10px] text-muted-foreground">{fmt$(costPerCr, 4)}</TableCell>
                      {margins.map((m, j) => (
                        <TableCell key={j} className="text-right">
                          <div className="font-mono text-xs">{fmt$(m.userPays)}</div>
                          <div className={cn("font-mono text-[10px] font-semibold",
                            m.margin > 95 ? "text-primary" : m.margin > 85 ? "text-amber-500" : "text-destructive"
                          )}>
                            {m.margin.toFixed(0)}%
                          </div>
                        </TableCell>
                      ))}
                      <TableCell className={cn("text-right font-mono text-xs font-bold",
                        best > 95 ? "text-primary" : best > 85 ? "text-amber-500" : "text-destructive"
                      )}>
                        {best.toFixed(0)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Most Expensive Action" value="Smart Finish" sub="$0.040 / 50 credits" accent="red" />
        <MetricCard label="Cheapest Action" value="AI Companion" sub="$0.005 / 5 credits" accent="green" />
        <MetricCard label="Highest Volume" value="Unlock Day" sub="60 credits — core monetization" accent="teal" />
        <MetricCard label="Worst Margin Action" value="Restaurant Rec" sub="$0.015 / 5cr = $0.003/cr" accent="amber" />
      </div>

      {/* Credit Flow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Credits Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-primary">Sources (Credits In)</p>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• Sign-up bonus: 150cr + 500cr early adopter</li>
                <li>• Monthly grant: 150cr/mo (all users, 2mo expiry)</li>
                <li>• Referral: 200cr per referral</li>
                <li>• Flex purchase: 100-500cr ($9-$39)</li>
                <li>• Club purchase: 600-3200cr ($49.99-$149.99)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-primary">Sinks (Credits Out)</p>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• Unlock days: 60cr/day (primary sink)</li>
                <li>• Editing: 5-10cr per action (after free cap)</li>
                <li>• Smart Finish: 50cr (manual trip enrichment)</li>
                <li>• Hotel search: 40cr/city</li>
                <li>• Group pools: 150-500cr (shared)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-primary">Expiration Rules</p>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• Free credits: expire after 2 months</li>
                <li>• Purchased base credits: never expire</li>
                <li>• Club bonus credits: 6-month expiry</li>
                <li>• Free credits used first (FIFO)</li>
                <li>• Max banked free: 300cr</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function UnitEconomics() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const { data: econData, isLoading, refetch } = useUnitEconomicsData();

  const renderTab = () => {
    if (!econData) return null;
    switch (activeTab) {
      case 'overview': return <OverviewTab data={econData} />;
      case 'revenue': return <RevenueTab data={econData} />;
      case 'costs': return <CostsTab data={econData} />;
      case 'users': return <UsersTab data={econData} />;
      case 'credits': return <CreditsTab data={econData} />;
      case 'forecast': return <ForecastTab data={econData} />;
      case 'projections': return <ProjectionsTab data={econData} />;
      case 'credit-economics': return <CreditEconomicsTab data={econData} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-[1400px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/profile" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-serif font-semibold text-foreground">Voyance · Business Dashboard</h1>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto flex">
        {/* Sidebar — desktop */}
        <nav className="hidden md:flex flex-col w-48 shrink-0 border-r bg-muted/30 min-h-[calc(100vh-65px)] p-3 gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  isActive
                    ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Mobile tab bar */}
        <div className="md:hidden w-full border-b overflow-x-auto">
          <div className="flex p-2 gap-1 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 p-6 min-w-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading dashboard data…</span>
            </div>
          ) : !econData ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No data available. Make sure you have admin access.</p>
            </div>
          ) : (
            renderTab()
          )}
        </main>
      </div>
    </div>
  );
}
