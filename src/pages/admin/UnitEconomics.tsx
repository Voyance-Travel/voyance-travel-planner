/**
 * Admin Business Dashboard — Multi-tab Light UI
 * Route: /admin/dashboard (redirected from /admin/margins)
 */

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, LayoutDashboard, DollarSign, TrendingDown, Users, Coins, LineChart, Settings, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
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

type TabKey = 'overview' | 'revenue' | 'costs' | 'users' | 'credits' | 'forecast';

const TABS: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'revenue', label: 'Revenue', icon: DollarSign },
  { key: 'costs', label: 'Costs', icon: TrendingDown },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'credits', label: 'Credits', icon: Coins },
  { key: 'forecast', label: 'Forecast', icon: LineChart },
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
          value={data.revenue.totalRevenue > 0 ? fmt$(data.revenue.totalRevenue) : '—'}
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
