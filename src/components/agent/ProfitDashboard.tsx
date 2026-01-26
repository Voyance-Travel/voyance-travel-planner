/**
 * Profit Dashboard Component
 * 
 * Displays comprehensive profit metrics computed from 3 sources:
 * - Sell price (client charges)
 * - Net cost (supplier costs)
 * - Commission (expected + received)
 * 
 * Key Metrics:
 * - Booked Revenue
 * - Expected Commission
 * - Received Commission
 * - Refund Exposure
 * - Net Margin
 */

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Banknote,
  AlertTriangle,
  RefreshCw,
  Download,
  ChevronRight,
  Loader2,
  PieChart,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

// ============================================
// Types
// ============================================

export interface ProfitMetrics {
  // Revenue
  booked_revenue_cents: number;      // Total sell prices
  collected_revenue_cents: number;   // Actual payments received
  outstanding_ar_cents: number;      // Uncollected client balances
  
  // Costs
  total_net_cost_cents: number;      // Supplier costs
  supplier_paid_cents: number;       // What's been paid to suppliers
  outstanding_ap_cents: number;      // Unpaid supplier balances
  
  // Commissions
  commission_expected_cents: number; // Expected from bookings
  commission_received_cents: number; // Actually received
  commission_pending_cents: number;  // Expected - Received
  
  // Margin
  gross_margin_cents: number;        // Revenue - Net Costs
  net_margin_cents: number;          // After commissions and fees
  margin_percentage: number;         // Net Margin / Revenue %
  
  // Risk
  refund_exposure_cents: number;     // Potential refund liability
  dispute_exposure_cents: number;    // Active disputes
  
  // Counts
  total_bookings: number;
  bookings_with_margin: number;
  bookings_at_risk: number;
}

export interface SupplierSummary {
  supplier_name: string;
  booking_count: number;
  sell_total_cents: number;
  net_cost_cents: number;
  commission_expected_cents: number;
  commission_received_cents: number;
  margin_cents: number;
  margin_percentage: number;
}

export interface TripSummary {
  trip_id: string;
  trip_name: string;
  destination: string;
  sell_total_cents: number;
  net_cost_cents: number;
  commission_expected_cents: number;
  commission_received_cents: number;
  margin_cents: number;
  margin_percentage: number;
}

interface ProfitDashboardProps {
  dateRange?: 'current_month' | 'last_month' | 'last_3_months' | 'ytd' | 'all';
  onImportClick?: () => void;
}

// ============================================
// Component
// ============================================

export default function ProfitDashboard({ 
  dateRange = 'current_month',
  onImportClick 
}: ProfitDashboardProps) {
  const [metrics, setMetrics] = useState<ProfitMetrics | null>(null);
  const [bySupplier, setBySupplier] = useState<SupplierSummary[]>([]);
  const [byTrip, setByTrip] = useState<TripSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState(dateRange);
  const [activeView, setActiveView] = useState<'overview' | 'suppliers' | 'trips'>('overview');

  // Get date range filters
  const getDateFilters = () => {
    const now = new Date();
    switch (selectedRange) {
      case 'current_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'last_3_months':
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case 'ytd':
        return { start: new Date(now.getFullYear(), 0, 1), end: now };
      default:
        return null;
    }
  };

  // Load metrics from booking segments
  useEffect(() => {
    loadMetrics();
  }, [selectedRange]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      const dateFilters = getDateFilters();
      
      // Query booking segments for the period
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('agency_booking_segments')
        .select(`
          id,
          trip_id,
          vendor_name,
          segment_type,
          sell_price_cents,
          net_cost_cents,
          commission_expected_cents,
          commission_received_cents,
          status,
          is_refundable,
          settlement_type,
          supplier_paid_cents,
          created_at
        `);
      
      if (dateFilters) {
        query = query
          .gte('created_at', dateFilters.start.toISOString())
          .lte('created_at', dateFilters.end.toISOString());
      }

      const { data: segments, error } = await query;
      if (error) throw error;

      // Query payments for collected revenue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: payments } = await (supabase as any)
        .from('agency_payments')
        .select('amount_cents, status')
        .eq('status', 'completed');

      // Query trips for context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: trips } = await (supabase as any)
        .from('agency_trips')
        .select('id, name, destination, total_paid_cents');

      // Calculate metrics
      const calculated = calculateMetrics(segments || [], payments || [], trips || []);
      setMetrics(calculated.metrics);
      setBySupplier(calculated.bySupplier);
      setByTrip(calculated.byTrip);
    } catch (error) {
      console.error('Failed to load profit metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No financial data yet</h3>
          <p className="text-muted-foreground">
            Add booking segments with sell prices and costs to see profit metrics
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Profit Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Revenue, costs, and margins across all bookings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedRange} onValueChange={(v: typeof selectedRange) => setSelectedRange(v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          {onImportClick && (
            <Button variant="outline" size="sm" className="gap-2" onClick={onImportClick}>
              <Download className="h-4 w-4" />
              Import Payouts
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={loadMetrics} aria-label="Refresh metrics">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Top-Level Metric Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Booked Revenue */}
        <MetricCard
          title="Booked Revenue"
          value={formatCurrency(metrics.booked_revenue_cents)}
          subtext={`${formatCurrency(metrics.collected_revenue_cents)} collected`}
          icon={DollarSign}
          trend={metrics.outstanding_ar_cents > 0 ? {
            value: formatCurrency(metrics.outstanding_ar_cents),
            label: 'outstanding',
            negative: true
          } : undefined}
        />

        {/* Expected Commission */}
        <MetricCard
          title="Expected Commission"
          value={formatCurrency(metrics.commission_expected_cents)}
          subtext={`${metrics.bookings_with_margin} bookings with margin`}
          icon={Receipt}
        />

        {/* Received Commission */}
        <MetricCard
          title="Received Commission"
          value={formatCurrency(metrics.commission_received_cents)}
          subtext={metrics.commission_pending_cents > 0 
            ? `${formatCurrency(metrics.commission_pending_cents)} pending`
            : 'All commissions received'
          }
          icon={Banknote}
          accent={metrics.commission_received_cents > 0}
          progress={metrics.commission_expected_cents > 0 
            ? Math.round((metrics.commission_received_cents / metrics.commission_expected_cents) * 100)
            : 0
          }
        />

        {/* Net Margin */}
        <MetricCard
          title="Net Margin"
          value={formatCurrency(metrics.net_margin_cents)}
          subtext={formatPercent(metrics.margin_percentage)}
          icon={TrendingUp}
          accent={metrics.net_margin_cents > 0}
          trend={metrics.refund_exposure_cents > 0 ? {
            value: formatCurrency(metrics.refund_exposure_cents),
            label: 'refund exposure',
            negative: true
          } : undefined}
        />
      </div>

      {/* Detailed Views */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suppliers">By Supplier</TabsTrigger>
          <TabsTrigger value="trips">By Trip</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Cost Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Profit Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProfitBreakdownRow
                label="Total Sell Price"
                value={metrics.booked_revenue_cents}
                formatCurrency={formatCurrency}
                positive
              />
              <ProfitBreakdownRow
                label="Net Supplier Costs"
                value={-metrics.total_net_cost_cents}
                formatCurrency={formatCurrency}
              />
              <Separator />
              <ProfitBreakdownRow
                label="Gross Margin"
                value={metrics.gross_margin_cents}
                formatCurrency={formatCurrency}
                highlighted
              />
              <ProfitBreakdownRow
                label="Commission Received"
                value={metrics.commission_received_cents}
                formatCurrency={formatCurrency}
                positive
              />
              <Separator />
              <ProfitBreakdownRow
                label="Net Margin"
                value={metrics.net_margin_cents}
                formatCurrency={formatCurrency}
                highlighted
                large
              />
            </CardContent>
          </Card>

          {/* Balances */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Client A/R</span>
                  <Badge variant={metrics.outstanding_ar_cents > 0 ? 'destructive' : 'secondary'}>
                    {metrics.outstanding_ar_cents > 0 ? 'Outstanding' : 'Collected'}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(metrics.outstanding_ar_cents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Supplier A/P</span>
                  <Badge variant={metrics.outstanding_ap_cents > 0 ? 'outline' : 'secondary'}>
                    {metrics.outstanding_ap_cents > 0 ? 'Owed' : 'Paid'}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(metrics.outstanding_ap_cents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Pending Commissions</span>
                  <Badge variant={metrics.commission_pending_cents > 0 ? 'outline' : 'secondary'}>
                    {metrics.commission_pending_cents > 0 ? 'Awaiting' : 'Complete'}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(metrics.commission_pending_cents)}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Margin by Supplier</CardTitle>
              <CardDescription>Profit breakdown across vendors</CardDescription>
            </CardHeader>
            <CardContent>
              {bySupplier.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">No supplier data</p>
              ) : (
                <div className="space-y-3">
                  {bySupplier.map((supplier) => (
                    <SupplierRow
                      key={supplier.supplier_name}
                      supplier={supplier}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trips">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Margin by Trip</CardTitle>
              <CardDescription>Profit breakdown by trip</CardDescription>
            </CardHeader>
            <CardContent>
              {byTrip.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">No trip data</p>
              ) : (
                <div className="space-y-3">
                  {byTrip.map((trip) => (
                    <TripRow
                      key={trip.trip_id}
                      trip={trip}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// Sub-Components
// ============================================

interface MetricCardProps {
  title: string;
  value: string;
  subtext: string;
  icon: React.ElementType;
  accent?: boolean;
  progress?: number;
  trend?: { value: string; label: string; negative?: boolean };
}

function MetricCard({ title, value, subtext, icon: Icon, accent, progress, trend }: MetricCardProps) {
  return (
    <Card className={cn(accent && 'border-primary/30 bg-primary/5')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className={cn('h-4 w-4', accent ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <p className={cn('text-2xl font-bold', accent && 'text-primary')}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
        {progress !== undefined && (
          <Progress value={progress} className="h-1.5 mt-2" />
        )}
        {trend && (
          <div className={cn(
            'flex items-center gap-1 mt-2 text-xs',
            trend.negative ? 'text-amber-600' : 'text-green-600'
          )}>
            {trend.negative ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <TrendingUp className="h-3 w-3" />
            )}
            <span>{trend.value} {trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfitBreakdownRow({
  label,
  value,
  formatCurrency,
  positive,
  highlighted,
  large,
}: {
  label: string;
  value: number;
  formatCurrency: (cents: number) => string;
  positive?: boolean;
  highlighted?: boolean;
  large?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between',
      highlighted && 'font-medium',
      large && 'text-lg'
    )}>
      <span className={cn(highlighted ? 'text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
      <span className={cn(
        value >= 0 ? (positive ? 'text-green-600' : 'text-foreground') : 'text-red-600'
      )}>
        {value >= 0 ? '' : '-'}{formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}

function SupplierRow({
  supplier,
  formatCurrency
}: {
  supplier: SupplierSummary;
  formatCurrency: (cents: number) => string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div>
        <p className="font-medium">{supplier.supplier_name || 'Unknown Supplier'}</p>
        <p className="text-xs text-muted-foreground">{supplier.booking_count} bookings</p>
      </div>
      <div className="text-right">
        <p className="font-medium">{formatCurrency(supplier.margin_cents)}</p>
        <p className={cn(
          'text-xs',
          supplier.margin_percentage >= 15 ? 'text-green-600' : 
          supplier.margin_percentage >= 10 ? 'text-amber-600' : 'text-red-600'
        )}>
          {supplier.margin_percentage.toFixed(1)}% margin
        </p>
      </div>
    </div>
  );
}

function TripRow({
  trip,
  formatCurrency
}: {
  trip: TripSummary;
  formatCurrency: (cents: number) => string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div>
        <p className="font-medium">{trip.trip_name}</p>
        <p className="text-xs text-muted-foreground">{trip.destination}</p>
      </div>
      <div className="text-right">
        <p className="font-medium">{formatCurrency(trip.margin_cents)}</p>
        <p className={cn(
          'text-xs',
          trip.margin_percentage >= 15 ? 'text-green-600' : 
          trip.margin_percentage >= 10 ? 'text-amber-600' : 'text-red-600'
        )}>
          {trip.margin_percentage.toFixed(1)}% margin
        </p>
      </div>
    </div>
  );
}

// ============================================
// Calculation Logic
// ============================================

function calculateMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  segments: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payments: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trips: any[]
): {
  metrics: ProfitMetrics;
  bySupplier: SupplierSummary[];
  byTrip: TripSummary[];
} {
  // Aggregate metrics
  let booked_revenue_cents = 0;
  let total_net_cost_cents = 0;
  let commission_expected_cents = 0;
  let commission_received_cents = 0;
  let supplier_paid_cents = 0;
  let refund_exposure_cents = 0;
  let bookings_with_margin = 0;
  let bookings_at_risk = 0;

  // Supplier aggregation
  const supplierMap = new Map<string, {
    sell: number;
    cost: number;
    expected: number;
    received: number;
    count: number;
  }>();

  // Trip aggregation
  const tripMap = new Map<string, {
    name: string;
    destination: string;
    sell: number;
    cost: number;
    expected: number;
    received: number;
  }>();

  for (const seg of segments) {
    const sell = seg.sell_price_cents || 0;
    const net = seg.net_cost_cents || 0;
    const expected = seg.commission_expected_cents || 0;
    const received = seg.commission_received_cents || 0;
    const paid = seg.supplier_paid_cents || 0;

    booked_revenue_cents += sell;
    total_net_cost_cents += net;
    commission_expected_cents += expected;
    commission_received_cents += received;
    supplier_paid_cents += paid;

    if (sell > net || expected > 0) {
      bookings_with_margin++;
    }

    if (seg.is_refundable && seg.status !== 'cancelled') {
      refund_exposure_cents += sell;
    }

    // Supplier grouping
    const vendor = seg.vendor_name || 'Unknown';
    const existing = supplierMap.get(vendor) || { sell: 0, cost: 0, expected: 0, received: 0, count: 0 };
    supplierMap.set(vendor, {
      sell: existing.sell + sell,
      cost: existing.cost + net,
      expected: existing.expected + expected,
      received: existing.received + received,
      count: existing.count + 1,
    });

    // Trip grouping
    if (seg.trip_id) {
      const trip = trips.find(t => t.id === seg.trip_id);
      const tripData = tripMap.get(seg.trip_id) || {
        name: trip?.name || 'Unknown Trip',
        destination: trip?.destination || '',
        sell: 0,
        cost: 0,
        expected: 0,
        received: 0,
      };
      tripMap.set(seg.trip_id, {
        ...tripData,
        sell: tripData.sell + sell,
        cost: tripData.cost + net,
        expected: tripData.expected + expected,
        received: tripData.received + received,
      });
    }
  }

  const collected_revenue_cents = payments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
  const outstanding_ar_cents = Math.max(0, booked_revenue_cents - collected_revenue_cents);
  const outstanding_ap_cents = Math.max(0, total_net_cost_cents - supplier_paid_cents);
  const commission_pending_cents = Math.max(0, commission_expected_cents - commission_received_cents);
  const gross_margin_cents = booked_revenue_cents - total_net_cost_cents;
  const net_margin_cents = gross_margin_cents + commission_received_cents;
  const margin_percentage = booked_revenue_cents > 0 
    ? (net_margin_cents / booked_revenue_cents) * 100 
    : 0;

  // Build supplier summaries
  const bySupplier: SupplierSummary[] = Array.from(supplierMap.entries())
    .map(([name, data]) => ({
      supplier_name: name,
      booking_count: data.count,
      sell_total_cents: data.sell,
      net_cost_cents: data.cost,
      commission_expected_cents: data.expected,
      commission_received_cents: data.received,
      margin_cents: (data.sell - data.cost) + data.received,
      margin_percentage: data.sell > 0 
        ? ((data.sell - data.cost + data.received) / data.sell) * 100 
        : 0,
    }))
    .sort((a, b) => b.margin_cents - a.margin_cents);

  // Build trip summaries
  const byTrip: TripSummary[] = Array.from(tripMap.entries())
    .map(([id, data]) => ({
      trip_id: id,
      trip_name: data.name,
      destination: data.destination,
      sell_total_cents: data.sell,
      net_cost_cents: data.cost,
      commission_expected_cents: data.expected,
      commission_received_cents: data.received,
      margin_cents: (data.sell - data.cost) + data.received,
      margin_percentage: data.sell > 0 
        ? ((data.sell - data.cost + data.received) / data.sell) * 100 
        : 0,
    }))
    .sort((a, b) => b.margin_cents - a.margin_cents);

  return {
    metrics: {
      booked_revenue_cents,
      collected_revenue_cents,
      outstanding_ar_cents,
      total_net_cost_cents,
      supplier_paid_cents,
      outstanding_ap_cents,
      commission_expected_cents,
      commission_received_cents,
      commission_pending_cents,
      gross_margin_cents,
      net_margin_cents,
      margin_percentage,
      refund_exposure_cents,
      dispute_exposure_cents: 0,
      total_bookings: segments.length,
      bookings_with_margin,
      bookings_at_risk,
    },
    bySupplier,
    byTrip,
  };
}
