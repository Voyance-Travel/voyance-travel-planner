/**
 * Finance Subledger API
 * 
 * Service layer for the travel-specific finance ledger including:
 * - Ledger entries (payments, refunds, commissions, payouts)
 * - Payout runs
 * - Commission imports
 * - Profit calculations
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================
// Types
// ============================================

export type FinanceEntryType = 
  | 'client_charge'
  | 'client_payment'
  | 'client_refund'
  | 'client_credit'
  | 'supplier_payable'
  | 'supplier_payment'
  | 'commission_expected'
  | 'commission_received'
  | 'agent_earning'
  | 'agent_payout'
  | 'platform_fee'
  | 'stripe_fee'
  | 'adjustment';

export type FinanceEntrySource = 
  | 'stripe_webhook'
  | 'manual'
  | 'import'
  | 'system'
  | 'api';

export interface FinanceLedgerEntry {
  id: string;
  agent_id: string;
  trip_id?: string;
  segment_id?: string;
  invoice_id?: string;
  entry_type: FinanceEntryType;
  entry_source: FinanceEntrySource;
  amount_cents: number;
  currency: string;
  description: string;
  memo?: string;
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  stripe_refund_id?: string;
  stripe_transfer_id?: string;
  stripe_payout_id?: string;
  stripe_dispute_id?: string;
  external_reference?: string;
  effective_date: string;
  posted_at: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface PayoutRun {
  id: string;
  agent_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total_amount_cents: number;
  currency: string;
  line_count: number;
  stripe_transfer_id?: string;
  stripe_payout_id?: string;
  scheduled_for?: string;
  initiated_at?: string;
  completed_at?: string;
  created_at: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface PayoutLine {
  id: string;
  payout_run_id: string;
  agent_id: string;
  trip_id?: string;
  segment_id?: string;
  ledger_entry_id?: string;
  description: string;
  amount_cents: number;
  currency: string;
  source_type?: string;
  source_reference?: string;
  created_at: string;
}

export interface CommissionImport {
  id: string;
  agent_id: string;
  source: string;
  source_reference?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_amount_cents: number;
  currency: string;
  line_count: number;
  matched_count: number;
  unmatched_count: number;
  file_name?: string;
  processed_at?: string;
  error_message?: string;
  created_at: string;
  raw_data?: unknown;
}

export interface TripProfitSummary {
  trip_id: string;
  agent_id: string;
  trip_name: string;
  currency: string;
  total_client_charges_cents: number;
  total_client_payments_cents: number;
  total_refunds_cents: number;
  total_supplier_costs_cents: number;
  total_supplier_paid_cents: number;
  commission_expected_cents: number;
  commission_received_cents: number;
  platform_fees_cents: number;
  stripe_fees_cents: number;
  agent_earnings_cents: number;
  agent_paid_out_cents: number;
  trip_gross_profit_cents: number;
}

export interface AgentProfitSummary {
  // Agent/Agency Profit (operational)
  total_revenue_cents: number;        // All client payments received
  total_commissions_cents: number;    // All commissions received
  total_supplier_costs_cents: number; // All supplier payments made
  total_refunds_cents: number;        // All refunds/chargebacks
  total_stripe_fees_cents: number;    // Stripe processing fees
  total_payouts_cents: number;        // Payouts to agents
  gross_profit_cents: number;         // Revenue - Costs - Fees + Commission
  net_profit_cents: number;           // Gross - Payouts
  
  // Balances
  client_ar_cents: number;   // Outstanding client receivables
  supplier_ap_cents: number; // Outstanding supplier payables
  commission_pending_cents: number; // Expected but not received
  agent_payable_cents: number;      // Earned but not paid out
}

// ============================================
// API Functions
// ============================================

/**
 * Get ledger entries for a trip
 */
export async function getTripLedgerEntries(tripId: string): Promise<FinanceLedgerEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('finance_ledger_entries')
    .select('*')
    .eq('trip_id', tripId)
    .order('effective_date', { ascending: false });

  if (error) throw error;
  return (data || []) as FinanceLedgerEntry[];
}

/**
 * Get all ledger entries for the agent (optionally filtered)
 */
export async function getLedgerEntries(filters?: {
  tripId?: string;
  entryType?: FinanceEntryType;
  source?: FinanceEntrySource;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<FinanceLedgerEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('finance_ledger_entries')
    .select('*')
    .order('effective_date', { ascending: false });

  if (filters?.tripId) query = query.eq('trip_id', filters.tripId);
  if (filters?.entryType) query = query.eq('entry_type', filters.entryType);
  if (filters?.source) query = query.eq('entry_source', filters.source);
  if (filters?.startDate) query = query.gte('effective_date', filters.startDate);
  if (filters?.endDate) query = query.lte('effective_date', filters.endDate);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as FinanceLedgerEntry[];
}

/**
 * Create a manual ledger entry
 */
export async function createLedgerEntry(entry: Partial<FinanceLedgerEntry>): Promise<FinanceLedgerEntry> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData: Record<string, unknown> = {
    agent_id: user.user.id,
    entry_type: entry.entry_type,
    entry_source: entry.entry_source || 'manual',
    amount_cents: entry.amount_cents,
    currency: entry.currency || 'USD',
    description: entry.description,
    effective_date: entry.effective_date || new Date().toISOString().split('T')[0],
  };
  
  if (entry.trip_id) insertData.trip_id = entry.trip_id;
  if (entry.segment_id) insertData.segment_id = entry.segment_id;
  if (entry.invoice_id) insertData.invoice_id = entry.invoice_id;
  if (entry.memo) insertData.memo = entry.memo;
  if (entry.external_reference) insertData.external_reference = entry.external_reference;
  if (entry.metadata) insertData.metadata = entry.metadata;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('finance_ledger_entries')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data as FinanceLedgerEntry;
}

/**
 * Record commission received (for non-Stripe commissions)
 */
export async function recordCommissionReceived(params: {
  tripId?: string;
  segmentId?: string;
  amountCents: number;
  currency?: string;
  source: string; // 'viator', 'host_agency', 'hotel_direct', etc.
  reference?: string;
  memo?: string;
}): Promise<FinanceLedgerEntry> {
  return createLedgerEntry({
    trip_id: params.tripId,
    segment_id: params.segmentId,
    entry_type: 'commission_received',
    entry_source: 'manual',
    amount_cents: params.amountCents,
    currency: params.currency,
    description: `Commission received from ${params.source}`,
    memo: params.memo,
    external_reference: params.reference,
    metadata: { source: params.source },
  });
}

/**
 * Get trip profit summary from the view
 */
export async function getTripProfitSummary(tripId: string): Promise<TripProfitSummary | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('finance_trip_profit_summary')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) throw error;
  return data as TripProfitSummary | null;
}

/**
 * Calculate agent's overall profit summary
 */
export async function getAgentProfitSummary(): Promise<AgentProfitSummary> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entries, error } = await (supabase as any)
    .from('finance_ledger_entries')
    .select('entry_type, amount_cents');

  if (error) throw error;

  const summary: AgentProfitSummary = {
    total_revenue_cents: 0,
    total_commissions_cents: 0,
    total_supplier_costs_cents: 0,
    total_refunds_cents: 0,
    total_stripe_fees_cents: 0,
    total_payouts_cents: 0,
    gross_profit_cents: 0,
    net_profit_cents: 0,
    client_ar_cents: 0,
    supplier_ap_cents: 0,
    commission_pending_cents: 0,
    agent_payable_cents: 0,
  };

  for (const entry of entries || []) {
    switch (entry.entry_type) {
      case 'client_payment':
        summary.total_revenue_cents += entry.amount_cents;
        break;
      case 'client_charge':
        summary.client_ar_cents += entry.amount_cents;
        break;
      case 'client_refund':
      case 'client_credit':
        summary.total_refunds_cents += Math.abs(entry.amount_cents);
        break;
      case 'supplier_payable':
        summary.supplier_ap_cents += Math.abs(entry.amount_cents);
        break;
      case 'supplier_payment':
        summary.total_supplier_costs_cents += Math.abs(entry.amount_cents);
        summary.supplier_ap_cents -= Math.abs(entry.amount_cents);
        break;
      case 'commission_expected':
        summary.commission_pending_cents += entry.amount_cents;
        break;
      case 'commission_received':
        summary.total_commissions_cents += entry.amount_cents;
        summary.commission_pending_cents -= entry.amount_cents;
        break;
      case 'agent_earning':
        summary.agent_payable_cents += entry.amount_cents;
        break;
      case 'agent_payout':
        summary.total_payouts_cents += Math.abs(entry.amount_cents);
        summary.agent_payable_cents -= Math.abs(entry.amount_cents);
        break;
      case 'stripe_fee':
        summary.total_stripe_fees_cents += Math.abs(entry.amount_cents);
        break;
    }
  }

  // Calculate client A/R (charges - payments received)
  summary.client_ar_cents = Math.max(0, summary.client_ar_cents - summary.total_revenue_cents);

  // Calculate profits
  summary.gross_profit_cents = 
    summary.total_revenue_cents +
    summary.total_commissions_cents -
    summary.total_supplier_costs_cents -
    summary.total_refunds_cents -
    summary.total_stripe_fees_cents;

  summary.net_profit_cents = summary.gross_profit_cents - summary.total_payouts_cents;

  return summary;
}

// ============================================
// Payout Functions
// ============================================

/**
 * Get payout runs
 */
export async function getPayoutRuns(status?: string): Promise<PayoutRun[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('finance_payout_runs')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PayoutRun[];
}

/**
 * Get payout lines for a run
 */
export async function getPayoutLines(payoutRunId: string): Promise<PayoutLine[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('finance_payout_lines')
    .select('*')
    .eq('payout_run_id', payoutRunId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as PayoutLine[];
}

// ============================================
// Commission Import Functions
// ============================================

/**
 * Get commission imports
 */
export async function getCommissionImports(): Promise<CommissionImport[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('finance_commission_imports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CommissionImport[];
}

/**
 * Create a commission import record
 */
export async function createCommissionImport(params: {
  source: string;
  sourceReference?: string;
  fileName?: string;
  rawData?: unknown;
}): Promise<CommissionImport> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData: Record<string, unknown> = {
    agent_id: user.user.id,
    source: params.source,
    status: 'pending',
  };
  if (params.sourceReference) insertData.source_reference = params.sourceReference;
  if (params.fileName) insertData.file_name = params.fileName;
  if (params.rawData) insertData.raw_data = params.rawData;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('finance_commission_imports')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data as CommissionImport;
}

/**
 * Process commission import lines and create ledger entries
 */
export async function processCommissionImport(
  importId: string,
  lines: Array<{
    amountCents: number;
    description: string;
    tripId?: string;
    segmentId?: string;
    reference?: string;
    effectiveDate?: string;
  }>
): Promise<{ matched: number; unmatched: number }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  let matched = 0;
  let unmatched = 0;
  let totalAmount = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('finance_commission_imports')
    .update({ status: 'processing' })
    .eq('id', importId);

  for (const line of lines) {
    totalAmount += line.amountCents;

    // Try to match to existing booking
    if (line.tripId || line.segmentId) {
      matched++;
    } else {
      unmatched++;
    }

    // Create ledger entry for each line
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('finance_ledger_entries')
      .insert({
        agent_id: user.user.id,
        trip_id: line.tripId,
        segment_id: line.segmentId,
        entry_type: 'commission_received',
        entry_source: 'import',
        amount_cents: line.amountCents,
        currency: 'USD',
        description: line.description,
        external_reference: line.reference,
        effective_date: line.effectiveDate || new Date().toISOString().split('T')[0],
        metadata: { import_id: importId },
      });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('finance_commission_imports')
    .update({
      status: 'completed',
      total_amount_cents: totalAmount,
      line_count: lines.length,
      matched_count: matched,
      unmatched_count: unmatched,
      processed_at: new Date().toISOString(),
    })
    .eq('id', importId);

  return { matched, unmatched };
}

// ============================================
// Helper Functions
// ============================================

export function formatCurrency(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function getEntryTypeLabel(type: FinanceEntryType): string {
  const labels: Record<FinanceEntryType, string> = {
    client_charge: 'Client Charge',
    client_payment: 'Client Payment',
    client_refund: 'Refund',
    client_credit: 'Credit/Dispute',
    supplier_payable: 'Supplier Cost',
    supplier_payment: 'Supplier Payment',
    commission_expected: 'Commission Expected',
    commission_received: 'Commission Received',
    agent_earning: 'Agent Earning',
    agent_payout: 'Agent Payout',
    platform_fee: 'Platform Fee',
    stripe_fee: 'Stripe Fee',
    adjustment: 'Adjustment',
  };
  return labels[type] || type;
}

export function getEntryTypeColor(type: FinanceEntryType): string {
  const colors: Record<FinanceEntryType, string> = {
    client_charge: 'text-blue-600 bg-blue-50',
    client_payment: 'text-emerald-600 bg-emerald-50',
    client_refund: 'text-red-600 bg-red-50',
    client_credit: 'text-orange-600 bg-orange-50',
    supplier_payable: 'text-amber-600 bg-amber-50',
    supplier_payment: 'text-amber-700 bg-amber-50',
    commission_expected: 'text-purple-600 bg-purple-50',
    commission_received: 'text-purple-700 bg-purple-50',
    agent_earning: 'text-primary bg-primary/10',
    agent_payout: 'text-primary bg-primary/10',
    platform_fee: 'text-muted-foreground bg-muted',
    stripe_fee: 'text-muted-foreground bg-muted',
    adjustment: 'text-muted-foreground bg-muted',
  };
  return colors[type] || 'text-muted-foreground bg-muted';
}

export function getSourceLabel(source: FinanceEntrySource): string {
  const labels: Record<FinanceEntrySource, string> = {
    stripe_webhook: 'Stripe (Auto)',
    manual: 'Manual',
    import: 'Import',
    system: 'System',
    api: 'API',
  };
  return labels[source] || source;
}

// ============================================
// React Query Hooks
// ============================================

export function useTripLedgerEntries(tripId: string | undefined) {
  return useQuery({
    queryKey: ['finance', 'ledger', tripId],
    queryFn: () => tripId ? getTripLedgerEntries(tripId) : Promise.resolve([]),
    enabled: !!tripId,
  });
}

export function useLedgerEntries(filters?: Parameters<typeof getLedgerEntries>[0]) {
  return useQuery({
    queryKey: ['finance', 'ledger', 'all', filters],
    queryFn: () => getLedgerEntries(filters),
  });
}

export function useTripProfitSummary(tripId: string | undefined) {
  return useQuery({
    queryKey: ['finance', 'profit', tripId],
    queryFn: () => tripId ? getTripProfitSummary(tripId) : Promise.resolve(null),
    enabled: !!tripId,
  });
}

export function useAgentProfitSummary() {
  return useQuery({
    queryKey: ['finance', 'profit', 'agent'],
    queryFn: getAgentProfitSummary,
  });
}

export function usePayoutRuns(status?: string) {
  return useQuery({
    queryKey: ['finance', 'payouts', status],
    queryFn: () => getPayoutRuns(status),
  });
}

export function useCommissionImports() {
  return useQuery({
    queryKey: ['finance', 'imports'],
    queryFn: getCommissionImports,
  });
}

export function useCreateLedgerEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLedgerEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}

export function useRecordCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordCommissionReceived,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}
