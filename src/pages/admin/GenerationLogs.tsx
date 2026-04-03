/**
 * Admin Generation Performance Logs
 * Displays timing data, phase waterfalls, and error tracking for itinerary generation.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, AlertTriangle, ArrowLeft, Timer } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

interface GenerationLog {
  id: string;
  trip_id: string;
  created_at: string;
  total_duration_ms: number | null;
  status: string;
  phase_timings: Record<string, number>;
  day_timings: Array<{
    day: number; total_ms: number; ai_ms: number; enrich_ms: number; activities: number;
    meals?: { required: string[]; found: string[]; beforeGuard?: string[]; guardFired: boolean; injected?: string[] };
    transport?: { isTransitionDay: boolean; mode?: string | null; hadInterCityTravel?: boolean; fallbackInjected?: boolean };
    llm?: { model: string; promptTokens: number; completionTokens: number };
  }>;
  errors: Array<{ phase: string; error: string; timestamp: string }>;
  num_days: number | null;
  num_guests: number | null;
  destination: string | null;
  model_used: string | null;
  current_phase: string | null;
  progress_pct: number | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(ms: number | null): string {
  if (!ms) return '--';
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = Math.round(secs % 60);
  return `${mins}m ${remainSecs}s`;
}

function statusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
    case 'in_progress':
    case 'started': return <Clock className="h-4 w-4 text-primary animate-spin" />;
    default: return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  }
}

// ============================================================================
// WATERFALL CHART
// ============================================================================

function WaterfallChart({ phaseTimings, totalMs }: { phaseTimings: Record<string, number>; totalMs: number }) {
  const entries = Object.entries(phaseTimings).sort((a, b) => {
    // Sort by insertion order approximation — ai_call phases come after fetch phases
    const order = (name: string) => {
      if (name.startsWith('pre_chain')) return 0;
      if (name.startsWith('day_')) return 1 + parseInt(name.split('_')[1] || '0');
      if (name === 'finalize') return 100;
      return 50;
    };
    return order(a[0]) - order(b[0]);
  });

  const maxMs = Math.max(...Object.values(phaseTimings), 1);

  // Categorize for bottleneck analysis
  let aiTotal = 0, enrichTotal = 0, otherTotal = 0;
  for (const [name, ms] of entries) {
    if (name.includes('ai_call') || name.includes('_ai')) aiTotal += ms;
    else if (name.includes('enrich') || name.includes('venue')) enrichTotal += ms;
    else otherTotal += ms;
  }

  const bottleneck = aiTotal >= enrichTotal && aiTotal >= otherTotal
    ? `AI calls = ${totalMs > 0 ? Math.round((aiTotal / totalMs) * 100) : 0}% of total`
    : enrichTotal >= otherTotal
      ? `Venue enrichment = ${totalMs > 0 ? Math.round((enrichTotal / totalMs) * 100) : 0}% of total`
      : `Other = ${totalMs > 0 ? Math.round((otherTotal / totalMs) * 100) : 0}% of total`;

  return (
    <div className="space-y-1.5">
      {entries.map(([name, ms]) => {
        const pct = Math.max(2, (ms / maxMs) * 100);
        const isAi = name.includes('ai_call') || name.includes('_ai');
        const isEnrich = name.includes('enrich') || name.includes('venue');

        return (
          <div key={name} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono w-40 truncate text-right">{name}</span>
            <div className="flex-1 h-4 rounded bg-muted/30 overflow-hidden">
              <div
                className={`h-full rounded transition-all ${
                  isAi ? 'bg-primary' : isEnrich ? 'bg-accent' : 'bg-muted-foreground/40'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground w-16 text-right">{formatDuration(ms)}</span>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground mt-2 italic">Bottleneck: {bottleneck}</p>
    </div>
  );
}

// ============================================================================
// DAY TIMINGS TABLE
// ============================================================================

function DayTimingsTable({ dayTimings }: { dayTimings: GenerationLog['day_timings'] }) {
  if (!dayTimings || dayTimings.length === 0) return <p className="text-xs text-muted-foreground">No per-day data</p>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Day</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>AI</TableHead>
            <TableHead>Enrich</TableHead>
            <TableHead className="text-right">Acts</TableHead>
            <TableHead>Meals</TableHead>
            <TableHead>Transport</TableHead>
            <TableHead>LLM</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dayTimings.map(d => (
            <TableRow key={d.day}>
              <TableCell className="font-medium">{d.day}</TableCell>
              <TableCell className="font-mono text-xs">{formatDuration(d.total_ms)}</TableCell>
              <TableCell className="font-mono text-xs">{formatDuration(d.ai_ms)}</TableCell>
              <TableCell className="font-mono text-xs">{formatDuration(d.enrich_ms)}</TableCell>
              <TableCell className="text-right">{d.activities}</TableCell>
              <TableCell className="text-xs">
                {d.meals ? (
                  <div className="space-y-0.5">
                    <span className={d.meals.guardFired ? 'text-yellow-500 font-semibold' : 'text-muted-foreground'}>
                      {d.meals.found?.join(', ') || 'none'}
                    </span>
                    {d.meals.guardFired && (
                      <>
                        <div className="text-yellow-500 text-[10px]">⚠ guard fired{d.meals.injected?.length ? ` (+${d.meals.injected.join(', ')})` : ''}</div>
                        {d.meals.beforeGuard && (
                          <div className="text-muted-foreground text-[10px]">before: {d.meals.beforeGuard.join(', ') || 'none'}</div>
                        )}
                      </>
                    )}
                  </div>
                ) : <span className="text-muted-foreground">--</span>}
              </TableCell>
              <TableCell className="text-xs">
                {d.transport ? (
                  <div className="space-y-0.5">
                    <span>{d.transport.mode || 'local'}</span>
                    {d.transport.isTransitionDay && <span className="ml-1 text-primary text-[10px]">✈ transition</span>}
                  </div>
                ) : <span className="text-muted-foreground">--</span>}
              </TableCell>
              <TableCell className="text-xs font-mono">
                {d.llm ? (
                  <div className="space-y-0.5">
                    <span className="text-foreground">{d.llm.model?.split('/')?.pop() || d.llm.model}</span>
                    <div className="text-muted-foreground text-[10px]">
                      {d.llm.promptTokens + d.llm.completionTokens} tok
                    </div>
                  </div>
                ) : <span className="text-muted-foreground">--</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type DateRange = '1d' | '7d' | '30d';

export default function GenerationLogs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(!!data);
      });
  }, [user?.id]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const daysAgo = dateRange === '1d' ? 1 : dateRange === '7d' ? 7 : 30;
    const since = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('generation_logs')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setLogs(data as unknown as GenerationLog[]);
    }
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Summary stats
  const completedLogs = logs.filter(l => l.status === 'completed');
  const failedLogs = logs.filter(l => l.status === 'failed');
  const avgDuration = completedLogs.length > 0
    ? completedLogs.reduce((sum, l) => sum + (l.total_duration_ms || 0), 0) / completedLogs.length
    : 0;
  const slowest = completedLogs.length > 0
    ? Math.max(...completedLogs.map(l => l.total_duration_ms || 0))
    : 0;

  if (!isAdmin) {
    return (
      <MainLayout>
        <Head title="Generation Logs" />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Admin access required.</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Head title="Generation Performance Logs" />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Generation Performance Logs</h1>
              <p className="text-sm text-muted-foreground">{logs.length} generation runs found</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['1d', '7d', '30d'] as DateRange[]).map(range => (
              <Button
                key={range}
                variant={dateRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange(range)}
              >
                {range === '1d' ? 'Today' : range === '7d' ? '7 days' : '30 days'}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{logs.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Time</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatDuration(avgDuration)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Failures</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {failedLogs.length}
                {logs.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({Math.round((failedLogs.length / logs.length) * 100)}%)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Slowest</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatDuration(slowest)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Phase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <> 
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <TableCell>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="font-medium">{log.destination || '--'}</TableCell>
                        <TableCell>{log.num_days || '--'}</TableCell>
                        <TableCell className="font-mono text-sm">{formatDuration(log.total_duration_ms)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {statusIcon(log.status)}
                            <span className="text-sm capitalize">{log.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.status === 'in_progress' || log.status === 'started'
                            ? `${log.current_phase || '...'} (${log.progress_pct || 0}%)`
                            : log.current_phase || '--'
                          }
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow key={`${log.id}-detail`}>
                          <TableCell colSpan={7} className="bg-muted/20 p-4">
                            <div className="space-y-6">
                              {/* Phase Waterfall */}
                              {log.phase_timings && Object.keys(log.phase_timings).length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Timer className="h-4 w-4" /> Phase Breakdown
                                  </h4>
                                  <WaterfallChart
                                    phaseTimings={log.phase_timings}
                                    totalMs={log.total_duration_ms || 0}
                                  />
                                </div>
                              )}

                              {/* Per-Day Timings */}
                              {log.day_timings && log.day_timings.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold mb-3">Per-Day Breakdown</h4>
                                  <DayTimingsTable dayTimings={log.day_timings} />
                                </div>
                              )}

                              {/* Errors */}
                              {log.errors && log.errors.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 text-destructive">
                                    Errors ({log.errors.length})
                                  </h4>
                                  <div className="space-y-1">
                                    {log.errors.map((err, i) => (
                                      <div key={i} className="text-xs font-mono p-2 rounded bg-destructive/10 text-destructive">
                                        <span className="font-semibold">{err.phase}:</span> {err.error}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* No data message */}
                              {(!log.phase_timings || Object.keys(log.phase_timings).length === 0) &&
                               (!log.day_timings || log.day_timings.length === 0) && (
                                <p className="text-sm text-muted-foreground italic">
                                  {log.status === 'started' || log.status === 'in_progress'
                                    ? 'Generation in progress — data will appear as phases complete.'
                                    : 'No timing data recorded for this run.'
                                  }
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}

                {logs.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No generation logs found for this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
