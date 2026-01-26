/**
 * Finance Subledger Dashboard
 * 
 * Comprehensive view of the travel finance subledger showing:
 * - Agent/Agency Profit vs Platform Profit
 * - Ledger entries with filtering
 * - Commission tracking
 * - Payout history
 */

import { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Banknote,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  Filter,
  RefreshCw,
  ChevronDown,
  Plane,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import {
  useLedgerEntries,
  useAgentProfitSummary,
  usePayoutRuns,
  useCommissionImports,
  formatCurrency,
  getEntryTypeLabel,
  getEntryTypeColor,
  getSourceLabel,
  type FinanceLedgerEntry,
  type FinanceEntryType,
} from '@/services/financeSubledgerAPI';

interface FinanceSubledgerProps {
  tripId?: string; // Optional filter by trip
}

export default function FinanceSubledger({ tripId }: FinanceSubledgerProps) {
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  
  const { data: entries = [], isLoading: entriesLoading, refetch: refetchEntries } = useLedgerEntries({
    tripId,
    entryType: entryTypeFilter !== 'all' ? entryTypeFilter as FinanceEntryType : undefined,
    limit: 100,
  });
  
  const { data: profitSummary, isLoading: profitLoading } = useAgentProfitSummary();
  const { data: payoutRuns = [] } = usePayoutRuns();
  const { data: commissionImports = [] } = useCommissionImports();

  const filteredEntries = entries.filter(e => 
    sourceFilter === 'all' || e.entry_source === sourceFilter
  );

  // Calculate quick stats
  const recentPayments = entries
    .filter(e => e.entry_type === 'client_payment')
    .slice(0, 5);
  
  const pendingPayouts = payoutRuns.filter(p => p.status === 'pending' || p.status === 'processing');

  return (
    <div className="space-y-6">
      {/* Profit Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Profit */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Gross Profit</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className={`text-2xl font-bold ${(profitSummary?.gross_profit_cents || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(profitSummary?.gross_profit_cents || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue - Costs - Fees + Commission
            </p>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Revenue Collected</span>
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(profitSummary?.total_revenue_cents || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(profitSummary?.client_ar_cents || 0)} outstanding
            </p>
          </CardContent>
        </Card>

        {/* Commission */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Commission</span>
              <Banknote className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(profitSummary?.total_commissions_cents || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(profitSummary?.commission_pending_cents || 0)} pending
            </p>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Expenses</span>
              <ArrowDownRight className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(
                (profitSummary?.total_supplier_costs_cents || 0) + 
                (profitSummary?.total_stripe_fees_cents || 0) +
                (profitSummary?.total_refunds_cents || 0)
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supplier + Fees + Refunds
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="ledger" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        {/* Ledger Tab */}
        <TabsContent value="ledger" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Transaction Ledger</CardTitle>
                  <CardDescription>
                    All financial entries including Stripe auto-posts
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={entryTypeFilter} onValueChange={setEntryTypeFilter}>
                    <SelectTrigger className="w-[160px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="client_payment">Payments</SelectItem>
                      <SelectItem value="client_refund">Refunds</SelectItem>
                      <SelectItem value="commission_received">Commission</SelectItem>
                      <SelectItem value="supplier_payment">Supplier</SelectItem>
                      <SelectItem value="agent_payout">Payouts</SelectItem>
                      <SelectItem value="stripe_fee">Fees</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="stripe_webhook">Stripe</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="import">Import</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => refetchEntries()} aria-label="Refresh entries">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No ledger entries found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm">
                            {format(new Date(entry.effective_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getEntryTypeColor(entry.entry_type)}`}
                            >
                              {getEntryTypeLabel(entry.entry_type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {entry.description}
                            {entry.stripe_payment_intent_id && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (pi_...)
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {getSourceLabel(entry.entry_source)}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${
                            entry.amount_cents >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            {entry.amount_cents >= 0 ? '+' : ''}
                            {formatCurrency(entry.amount_cents, entry.currency)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commissions Tab */}
        <TabsContent value="commissions" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Commission Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-purple-600" />
                  Commission Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span className="text-sm font-medium">Expected</span>
                  <span className="font-bold">
                    {formatCurrency(
                      (profitSummary?.commission_pending_cents || 0) + 
                      (profitSummary?.total_commissions_cents || 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Received
                  </span>
                  <span className="font-bold text-emerald-600">
                    {formatCurrency(profitSummary?.total_commissions_cents || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Clock className="h-4 w-4 text-amber-600" />
                    Pending
                  </span>
                  <span className="font-bold text-amber-600">
                    {formatCurrency(profitSummary?.commission_pending_cents || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Commission Imports */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Commission Imports
                  </CardTitle>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                </div>
                <CardDescription>
                  Import commissions from Viator, host agencies, hotels, etc.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {commissionImports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No imports yet</p>
                    <p className="text-xs">Upload a CSV to import commission payments</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {commissionImports.slice(0, 5).map((imp) => (
                      <div 
                        key={imp.id} 
                        className="flex items-center justify-between p-2 border rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium">{imp.source}</p>
                          <p className="text-xs text-muted-foreground">
                            {imp.line_count} lines • {format(new Date(imp.created_at), 'MMM d')}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={imp.status === 'completed' ? 'default' : 'secondary'}>
                            {imp.status}
                          </Badge>
                          <p className="text-sm font-medium mt-1">
                            {formatCurrency(imp.total_amount_cents)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payout History
                  </CardTitle>
                  <CardDescription>
                    Agent payouts processed via Stripe Connect
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {pendingPayouts.length} pending
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {payoutRuns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No payout runs yet</p>
                  <p className="text-xs">Payouts are created from agent earnings</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lines</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutRuns.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>
                          {format(new Date(run.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              run.status === 'completed' ? 'default' : 
                              run.status === 'failed' ? 'destructive' : 
                              'secondary'
                            }
                          >
                            {run.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {run.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {run.status === 'processing' && <Clock className="h-3 w-3 mr-1" />}
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{run.line_count}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(run.total_amount_cents, run.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Agent Payable Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Agent Payable Balance</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(profitSummary?.agent_payable_cents || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(profitSummary?.total_payouts_cents || 0)} paid out total
                  </p>
                </div>
                <Button>
                  Request Payout
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
