/**
 * Travel-Specific Finance Ledger
 * 
 * A subledger that mirrors how travel agencies think:
 * - ARC/BSP (air settlement bucket)
 * - Supplier Direct (agency collects, then pays supplier)
 * - Commission Tracking (client pays supplier, commission due later)
 * 
 * This drives:
 * - Client Balance (A/R) — what client owes
 * - Vendor Balance (A/P) — what you owe suppliers
 * - Expected vs Received Commission
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Users, 
  Banknote, 
  TrendingUp, 
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plane,
  Hotel,
  Car,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { type BookingSegment } from '@/services/agencyCRM';
import { format } from 'date-fns';

interface FinanceLedgerProps {
  segments: BookingSegment[];
  tripTotalCents: number;
  tripPaidCents: number;
  tripCommissionCents: number;
  currency?: string;
  onSegmentClick?: (segment: BookingSegment) => void;
}

// Settlement type labels and descriptions
const SETTLEMENT_LABELS: Record<string, { label: string; description: string; color: string }> = {
  arc_bsp: { 
    label: 'ARC/BSP', 
    description: 'Airline reporting settlement',
    color: 'bg-blue-500/10 text-blue-600 border-blue-200'
  },
  supplier_direct: { 
    label: 'Supplier Direct', 
    description: 'Agency collects → pays supplier',
    color: 'bg-amber-500/10 text-amber-600 border-amber-200'
  },
  commission_track: { 
    label: 'Commission Track', 
    description: 'Client pays supplier, commission due',
    color: 'bg-purple-500/10 text-purple-600 border-purple-200'
  },
};

const SEGMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: Hotel,
  car_rental: Car,
  default: Building2,
};

export default function FinanceLedger({
  segments,
  tripTotalCents,
  tripPaidCents,
  tripCommissionCents,
  currency = 'USD',
  onSegmentClick,
}: FinanceLedgerProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ar: true,
    ap: true,
    commission: true,
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  // Calculate ledger summaries
  const ledgerData = useMemo(() => {
    // Group segments by settlement type
    const arcBsp = segments.filter(s => s.settlement_type === 'arc_bsp');
    const supplierDirect = segments.filter(s => s.settlement_type === 'supplier_direct' || !s.settlement_type);
    const commissionTrack = segments.filter(s => s.settlement_type === 'commission_track');

    // A/R: What clients owe (total sell price - what's paid)
    const totalClientCharges = segments.reduce((sum, s) => sum + (s.sell_price_cents || 0), 0);
    const clientBalance = totalClientCharges - tripPaidCents;

    // A/P: What we owe suppliers (only for supplier_direct)
    const totalSupplierOwed = supplierDirect.reduce((sum, s) => sum + (s.net_cost_cents || 0), 0);
    const totalSupplierPaid = supplierDirect.reduce((sum, s) => sum + (s.supplier_paid_cents || 0), 0);
    const vendorBalance = totalSupplierOwed - totalSupplierPaid;

    // Commission tracking
    const commissionExpected = segments.reduce((sum, s) => sum + (s.commission_expected_cents || s.commission_cents || 0), 0);
    const commissionReceived = segments.reduce((sum, s) => sum + (s.commission_received_cents || 0), 0);
    const commissionPending = commissionExpected - commissionReceived;

    return {
      arcBsp,
      supplierDirect,
      commissionTrack,
      clientBalance,
      totalClientCharges,
      vendorBalance,
      totalSupplierOwed,
      totalSupplierPaid,
      commissionExpected,
      commissionReceived,
      commissionPending,
    };
  }, [segments, tripPaidCents]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getSegmentIcon = (type: string) => {
    const Icon = SEGMENT_ICONS[type] || SEGMENT_ICONS.default;
    return Icon;
  };

  return (
    <div className="space-y-6">
      {/* Ledger Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* A/R Card - Client Balance */}
        <Card className={ledgerData.clientBalance > 0 ? 'border-amber-200' : 'border-emerald-200'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Client Balance (A/R)</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className={`text-2xl font-bold ${ledgerData.clientBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {formatCurrency(ledgerData.clientBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(tripPaidCents)} of {formatCurrency(ledgerData.totalClientCharges)} collected
            </p>
            <Progress 
              value={ledgerData.totalClientCharges > 0 ? (tripPaidCents / ledgerData.totalClientCharges) * 100 : 0} 
              className="mt-2 h-1.5" 
            />
          </CardContent>
        </Card>

        {/* A/P Card - Vendor Balance */}
        <Card className={ledgerData.vendorBalance > 0 ? 'border-red-200' : 'border-emerald-200'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Vendor Balance (A/P)</span>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className={`text-2xl font-bold ${ledgerData.vendorBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {formatCurrency(ledgerData.vendorBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(ledgerData.totalSupplierPaid)} of {formatCurrency(ledgerData.totalSupplierOwed)} paid
            </p>
            <Progress 
              value={ledgerData.totalSupplierOwed > 0 ? (ledgerData.totalSupplierPaid / ledgerData.totalSupplierOwed) * 100 : 0} 
              className="mt-2 h-1.5" 
            />
          </CardContent>
        </Card>

        {/* Commission Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Commission</span>
              <Banknote className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(ledgerData.commissionReceived)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(ledgerData.commissionPending)} pending of {formatCurrency(ledgerData.commissionExpected)} expected
            </p>
            <Progress 
              value={ledgerData.commissionExpected > 0 ? (ledgerData.commissionReceived / ledgerData.commissionExpected) * 100 : 0} 
              className="mt-2 h-1.5" 
            />
          </CardContent>
        </Card>
      </div>

      {/* Settlement Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Settlement Breakdown</CardTitle>
          <CardDescription>
            How each booking is processed financially
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ARC/BSP Section */}
          {ledgerData.arcBsp.length > 0 && (
            <Collapsible 
              open={expandedSections.arc}
              onOpenChange={() => toggleSection('arc')}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                      ARC/BSP
                    </Badge>
                    <span className="font-medium">{ledgerData.arcBsp.length} bookings</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">
                      {formatCurrency(ledgerData.arcBsp.reduce((sum, s) => sum + (s.sell_price_cents || 0), 0))}
                    </span>
                    {expandedSections.arc ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2 pl-4">
                {ledgerData.arcBsp.map(segment => {
                  const Icon = getSegmentIcon(segment.segment_type);
                  return (
                    <div 
                      key={segment.id}
                      className="flex items-center justify-between p-2 rounded border bg-muted/30 cursor-pointer hover:bg-muted/50"
                      onClick={() => onSegmentClick?.(segment)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{segment.vendor_name || 'Unnamed'}</span>
                        {segment.arc_report_number && (
                          <Badge variant="outline" className="text-xs">
                            #{segment.arc_report_number}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {formatCurrency(segment.sell_price_cents || 0)}
                      </span>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Supplier Direct Section */}
          {ledgerData.supplierDirect.length > 0 && (
            <Collapsible 
              open={expandedSections.ap}
              onOpenChange={() => toggleSection('ap')}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                      Supplier Direct
                    </Badge>
                    <span className="font-medium">{ledgerData.supplierDirect.length} bookings</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold">
                        {formatCurrency(ledgerData.supplierDirect.reduce((sum, s) => sum + (s.net_cost_cents || 0), 0))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(ledgerData.vendorBalance)} owed
                      </p>
                    </div>
                    {expandedSections.ap ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2 pl-4">
                {ledgerData.supplierDirect.map(segment => {
                  const Icon = getSegmentIcon(segment.segment_type);
                  const isPaid = (segment.supplier_paid_cents || 0) >= (segment.net_cost_cents || 0);
                  return (
                    <div 
                      key={segment.id}
                      className="flex items-center justify-between p-2 rounded border bg-muted/30 cursor-pointer hover:bg-muted/50"
                      onClick={() => onSegmentClick?.(segment)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{segment.vendor_name || 'Unnamed'}</span>
                        {isPaid ? (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">
                            <Clock className="h-3 w-3 mr-1" />
                            Unpaid
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">
                          {formatCurrency(segment.net_cost_cents || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Commission Track Section */}
          {ledgerData.commissionTrack.length > 0 && (
            <Collapsible 
              open={expandedSections.commission}
              onOpenChange={() => toggleSection('commission')}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-200">
                      Commission Track
                    </Badge>
                    <span className="font-medium">{ledgerData.commissionTrack.length} bookings</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-primary">
                        {formatCurrency(ledgerData.commissionTrack.reduce((sum, s) => sum + (s.commission_expected_cents || s.commission_cents || 0), 0))}
                      </p>
                      <p className="text-xs text-muted-foreground">expected</p>
                    </div>
                    {expandedSections.commission ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2 pl-4">
                {ledgerData.commissionTrack.map(segment => {
                  const Icon = getSegmentIcon(segment.segment_type);
                  const isReceived = (segment.commission_received_cents || 0) >= (segment.commission_expected_cents || segment.commission_cents || 0);
                  return (
                    <div 
                      key={segment.id}
                      className="flex items-center justify-between p-2 rounded border bg-muted/30 cursor-pointer hover:bg-muted/50"
                      onClick={() => onSegmentClick?.(segment)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{segment.vendor_name || 'Unnamed'}</span>
                        {isReceived ? (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Received
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-primary">
                          {formatCurrency(segment.commission_expected_cents || segment.commission_cents || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {segments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No bookings to display in ledger</p>
              <p className="text-xs">Add bookings with settlement types to see financial breakdown</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
