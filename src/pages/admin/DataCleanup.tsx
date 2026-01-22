import { useState, useTransition, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle, XCircle, AlertCircle, Database, Sparkles, MapPin, Building, Compass } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MainLayout from '@/components/layout/MainLayout';
import type { CleanupResponse, CleanupResult, CleanupStats } from './data-cleanup/cleanupTypes';
import { useCleanupCheckpoint, type CleanupTarget } from './data-cleanup/useCleanupCheckpoint';

export default function DataCleanup() {
  const [activeTab, setActiveTab] = useState<CleanupTarget>('destinations');
  const [isRunning, setIsRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [results, setResults] = useState<CleanupResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, remaining: 0 });
  const [datasetCounts, setDatasetCounts] = useState<{ total: number; dirty: number; clean: number } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState<CleanupStats>({ updated: 0, clean: 0, errors: 0, processed: 0 });
  const [, startTransition] = useTransition();

  // Maintain independent checkpoints per target so switching tabs mid-run can't corrupt the active run's checkpoint.
  const destinationsCheckpoint = useCleanupCheckpoint('destinations');
  const attractionsCheckpoint = useCleanupCheckpoint('attractions');
  const localKnowledgeCheckpoint = useCleanupCheckpoint('local-knowledge');

  const getCheckpointApi = (target: CleanupTarget) => {
    if (target === 'destinations') return destinationsCheckpoint;
    if (target === 'attractions') return attractionsCheckpoint;
    return localKnowledgeCheckpoint;
  };

  const checkpointRef = useRef<{
    dryRun: boolean;
    offset: number;
    processedTotal: number;
    totalCount: number;
    stats: CleanupStats;
  } | null>(null);

  const runningTargetRef = useRef<CleanupTarget | null>(null);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const runningTarget = runningTargetRef.current;
      if (isRunning && runningTarget && checkpointRef.current) {
        getCheckpointApi(runningTarget).saveCheckpoint(checkpointRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRunning, destinationsCheckpoint.saveCheckpoint, attractionsCheckpoint.saveCheckpoint, localKnowledgeCheckpoint.saveCheckpoint]);

  const MAX_LOG_LINES = 400;
  const MAX_RESULTS = 200;

  const addLogs = (messages: string[]) => {
    if (messages.length === 0) return;
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => {
      const next = [...prev, ...messages.map(m => `[${ts}] ${m}`)];
      return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
    });
  };

  const addLog = (message: string) => addLogs([message]);

  const runCleanup = async (
    target: CleanupTarget,
    opts?: { resume?: boolean; dryRunOverride?: boolean }
  ) => {
    const resume = !!opts?.resume;

    const checkpointApi = getCheckpointApi(target);
    const { checkpoint, saveCheckpoint, clearCheckpoint } = checkpointApi;
    runningTargetRef.current = target;

    // When resuming, prefer the checkpoint's mode unless explicitly overridden.
    const runDryRun = opts?.dryRunOverride ?? (resume && checkpoint ? checkpoint.dryRun : dryRun);

    setIsRunning(true);
    setResults([]);
    setLogs([]);
    setProgress({ current: 0, total: 0, remaining: 0 });
    setDatasetCounts(null);
    setStats({ updated: 0, clean: 0, errors: 0, processed: 0 });

    // Get total count based on target
    let totalCount = 0;
    let overallCount: number | null = null;
    if (target === 'destinations') {
      const { count } = await supabase
        .from('destinations')
        .select('*', { count: 'exact', head: true })
        .or('currency_code.is.null,timezone.is.null,cost_tier.is.null');
      totalCount = count || 0;
    } else if (target === 'attractions') {
      const [{ count: dirtyCount }, { count: allCount }] = await Promise.all([
        supabase
          .from('attractions')
          .select('*', { count: 'exact', head: true })
          .or('description.ilike.Popular %,and(latitude.lt.1,latitude.gt.-1,longitude.lt.1,longitude.gt.-1)'),
        supabase
          .from('attractions')
          .select('*', { count: 'exact', head: true })
      ]);

      totalCount = dirtyCount || 0;
      overallCount = allCount ?? null;

      if (typeof overallCount === 'number') {
        setDatasetCounts({
          total: overallCount,
          dirty: totalCount,
          clean: Math.max(0, overallCount - totalCount),
        });
      }
      // totalCount is the dirty count.
    } else if (target === 'local-knowledge') {
      const { count } = await supabase
        .from('destinations')
        .select('*', { count: 'exact', head: true })
        .or('default_transport_modes.is.null,default_transport_modes.eq.[]');
      totalCount = count || 0;
    }
    const shouldResume = resume && !!checkpoint;
    if (!shouldResume) {
      clearCheckpoint();
    }

    // IMPORTANT: For LIVE runs (not dry runs), records get updated and no longer match the 
    // "dirty records" filter. This means the result set shrinks after each batch.
    // Therefore, we should always start at offset 0 for live runs - the remaining dirty
    // records are always at the beginning of the filtered result set.
    // Only dry runs should use checkpoint offset since they don't modify data.
    const useCheckpointOffset = shouldResume && runDryRun;
    
    let offset = useCheckpointOffset ? checkpoint.offset : 0;
    const batchSize = 5;

    const processedTotalAtStart = shouldResume ? checkpoint.processedTotal : 0;
    // For progress UI we need a stable total across resumes.
    // We persist the baseline total in the checkpoint (checkpoint.totalCount).
    // Clamp so we never show current > total due to older checkpoints / filter changes.
    const baselineTotal = shouldResume
      ? Math.max(checkpoint.totalCount, processedTotalAtStart)
      : totalCount;

    let processedTotal = processedTotalAtStart;
    let statsTotal: CleanupStats = shouldResume
      ? checkpoint!.stats
      : { updated: 0, clean: 0, errors: 0, processed: 0 };

    // Progress for LIVE runs should reflect how many dirty records are now clean.
    // Using (baseline - remaining) avoids confusing "processed" counts.
    const initialCleaned = runDryRun ? processedTotal : Math.max(0, baselineTotal - totalCount);
    setProgress({ current: initialCleaned, total: baselineTotal, remaining: totalCount });
    addLog(
      `Starting ${target} cleanup: ${totalCount} dirty records remaining (baseline: ${baselineTotal}) [${runDryRun ? 'DRY RUN' : 'LIVE'}]`
    );

    if (shouldResume) {
      setStats(statsTotal);
      const resumedCleaned = runDryRun ? processedTotal : Math.max(0, baselineTotal - totalCount);
      setProgress({ current: resumedCleaned, total: baselineTotal, remaining: totalCount });
      if (useCheckpointOffset) {
        addLog(
          `Resuming dry run from offset ${offset} (processed ${processedTotal}/${baselineTotal})`
        );
      } else {
        addLog(
          `Resuming live run: ${stats.updated} cleaned so far, ${totalCount} dirty records remaining`
        );
      }
    }

    const functionName = target === 'destinations' ? 'cleanup-destinations' : target === 'attractions' ? 'cleanup-attractions' : 'enrich-destinations';

    try {
      while (true) {
        addLog(`Processing batch starting at offset ${offset}...`);
        
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { batchSize, offset, dryRun: runDryRun }
        });

        if (error) {
          addLog(`Error: ${error.message}`);
          toast.error(`Cleanup failed: ${error.message}`);
          break;
        }

        const response = data as CleanupResponse;

        const nextOffset = response.nextOffset ?? offset + batchSize;

        const batchUpdated = response.results.filter(r => r.status === 'updated' || r.status === 'would_update').length;
        const batchClean = response.results.filter(r => r.status === 'no_changes_needed').length;
        const batchErrors = response.results.filter(r => r.status === 'error' || r.status === 'ai_failed').length;
        processedTotal += response.processed;

        statsTotal = {
          updated: statsTotal.updated + batchUpdated,
          clean: statsTotal.clean + batchClean,
          errors: statsTotal.errors + batchErrors,
          processed: statsTotal.processed + response.processed,
        };

        // Persist progress after each batch so a crash/refresh can resume without re-processing.
        // For live runs, persist a stable baseline total (not the current dirty count).
        const nextCheckpointOffset = runDryRun ? nextOffset : 0;
        checkpointRef.current = {
          dryRun: runDryRun,
          offset: nextCheckpointOffset,
          processedTotal,
          totalCount: baselineTotal,
          stats: statsTotal,
        };
        saveCheckpoint(checkpointRef.current);

        // Remaining dirty: exact for attractions LIVE (periodically re-count), otherwise an estimate.
        let nextRemaining = runDryRun
          ? Math.max(0, baselineTotal - processedTotal)
          : Math.max(0, baselineTotal - statsTotal.updated);

        // For Attractions LIVE: refresh remaining dirty from the DB every ~10 batches.
        // This keeps the UI aligned with the shrinking dirty pool.
        if (!runDryRun && target === 'attractions' && (processedTotal % (batchSize * 10) === 0)) {
          const { count: liveDirtyCount } = await supabase
            .from('attractions')
            .select('*', { count: 'exact', head: true })
            .or('description.ilike.Popular %,and(latitude.lt.1,latitude.gt.-1,longitude.lt.1,longitude.gt.-1)');
          if (typeof liveDirtyCount === 'number') {
            nextRemaining = liveDirtyCount;
            setDatasetCounts(prev => {
              if (!prev) return prev;
              return { ...prev, dirty: liveDirtyCount, clean: Math.max(0, prev.total - liveDirtyCount) };
            });
          }
        }

        const cleanedSoFar = runDryRun
          ? processedTotal
          : Math.max(0, baselineTotal - nextRemaining);

        startTransition(() => {
          setStats(statsTotal);

          setResults(prev => {
            // Filter out "no_changes_needed" to reduce noise
            const filtered = response.results.filter(r => r.status !== 'no_changes_needed');
            const next = [...prev, ...filtered];
            return next.length > MAX_RESULTS ? next.slice(-MAX_RESULTS) : next;
          });

          setProgress({ current: cleanedSoFar, total: baselineTotal, remaining: nextRemaining });
        });

        const batchLogs: string[] = [];
        response.results.forEach(r => {
          const itemName = r.city || r.name || r.id;
          if (r.status === 'updated' || r.status === 'would_update') {
            batchLogs.push(`✓ ${itemName}: ${r.status}`);
          } else if (r.status === 'error' || r.status === 'ai_failed') {
            batchLogs.push(`✗ ${itemName}: ${r.status}`);
          }
        });
        addLogs(batchLogs);
        
        if (response.complete) {
          addLog(`All ${target} processed!`);
          clearCheckpoint();
          checkpointRef.current = null;
          break;
        }

        // Dry runs paginate through a static set; live runs must always re-query from the start
        // because the result set shrinks as records are cleaned.
        offset = runDryRun ? nextOffset : 0;

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      toast.success(`Cleanup complete! Processed ${processedTotal} ${target}.`);
    } catch (err) {
      addLog(`Fatal error: ${err instanceof Error ? err.message : 'Unknown'}`);
      toast.error('Cleanup failed');
    } finally {
      setIsRunning(false);
      runningTargetRef.current = null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'updated':
      case 'would_update':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'no_changes_needed':
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      case 'error':
      case 'ai_failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'updated':
        return <Badge variant="default">Updated</Badge>;
      case 'would_update':
        return <Badge variant="secondary">Would Update</Badge>;
      case 'no_changes_needed':
        return <Badge variant="outline">Clean</Badge>;
      case 'error':
      case 'ai_failed':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Database className="h-8 w-8" />
            Data Cleanup
          </h1>
          <p className="text-muted-foreground mt-2">
            Use AI to clean and improve data quality
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CleanupTarget)}>
          <TabsList className="mb-6">
            <TabsTrigger value="destinations" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Destinations
            </TabsTrigger>
            <TabsTrigger value="attractions" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Attractions
            </TabsTrigger>
            <TabsTrigger value="local-knowledge" className="flex items-center gap-2">
              <Compass className="h-4 w-4" />
              Local Knowledge
            </TabsTrigger>
          </TabsList>

          <TabsContent value="destinations">
            <div>
              <CleanupPanel
                target="destinations"
                description="Clean destination data (currency, timezone, cost tier)"
                isRunning={isRunning}
                dryRun={dryRun}
                setDryRun={setDryRun}
                hasCheckpoint={destinationsCheckpoint.hasCheckpoint}
                checkpointDryRun={destinationsCheckpoint.checkpoint?.dryRun ?? null}
                progress={progress}
                stats={stats}
                logs={logs}
                results={results}
                onRun={() => runCleanup('destinations')}
                onResume={() => {
                  const mode = destinationsCheckpoint.checkpoint?.dryRun;
                  if (typeof mode === 'boolean') setDryRun(mode);
                  return runCleanup('destinations', { resume: true, dryRunOverride: mode });
                }}
                getStatusIcon={getStatusIcon}
                getStatusBadge={getStatusBadge}
              />
            </div>
          </TabsContent>

          <TabsContent value="attractions">
            <div>
              <CleanupPanel
                target="attractions"
                description="Clean attraction data (descriptions, coordinates, destination links)"
                isRunning={isRunning}
                dryRun={dryRun}
                setDryRun={setDryRun}
                hasCheckpoint={attractionsCheckpoint.hasCheckpoint}
                checkpointDryRun={attractionsCheckpoint.checkpoint?.dryRun ?? null}
                checkpointProcessed={attractionsCheckpoint.checkpoint?.processedTotal ?? null}
                progress={progress}
                datasetCounts={datasetCounts}
                stats={stats}
                logs={logs}
                results={results}
                onRun={() => runCleanup('attractions')}
                onResume={() => {
                  const mode = attractionsCheckpoint.checkpoint?.dryRun;
                  if (typeof mode === 'boolean') setDryRun(mode);
                  return runCleanup('attractions', { resume: true, dryRunOverride: mode });
                }}
                onUpdateCheckpoint={(processedTotal: number) => {
                  const current = attractionsCheckpoint.checkpoint;
                  if (current) {
                    attractionsCheckpoint.saveCheckpoint({
                      ...current,
                      processedTotal,
                      stats: { ...current.stats, processed: processedTotal }
                    });
                    toast.success(`Checkpoint updated to ${processedTotal} processed`);
                  }
                }}
                getStatusIcon={getStatusIcon}
                getStatusBadge={getStatusBadge}
              />
            </div>
          </TabsContent>

          <TabsContent value="local-knowledge">
            <div>
              <CleanupPanel
                target="local-knowledge"
                description="Enrich destinations with local transport tips, safety info, scams to avoid, tipping customs, and insider knowledge"
                isRunning={isRunning}
                dryRun={dryRun}
                setDryRun={setDryRun}
                hasCheckpoint={localKnowledgeCheckpoint.hasCheckpoint}
                checkpointDryRun={localKnowledgeCheckpoint.checkpoint?.dryRun ?? null}
                progress={progress}
                stats={stats}
                logs={logs}
                results={results}
                onRun={() => runCleanup('local-knowledge')}
                onResume={() => {
                  const mode = localKnowledgeCheckpoint.checkpoint?.dryRun;
                  if (typeof mode === 'boolean') setDryRun(mode);
                  return runCleanup('local-knowledge', { resume: true, dryRunOverride: mode });
                }}
                getStatusIcon={getStatusIcon}
                getStatusBadge={getStatusBadge}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

interface CleanupPanelProps {
  target: CleanupTarget;
  description: string;
  isRunning: boolean;
  dryRun: boolean;
  setDryRun: (v: boolean) => void;
  hasCheckpoint: boolean;
  checkpointDryRun: boolean | null;
  checkpointProcessed?: number | null;
  progress: { current: number; total: number; remaining: number };
  datasetCounts?: { total: number; dirty: number; clean: number } | null;
  stats: CleanupStats;
  logs: string[];
  results: CleanupResult[];
  onRun: () => void;
  onResume: () => void;
  onUpdateCheckpoint?: (processedTotal: number) => void;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadge: (status: string) => React.ReactNode;
}

function CleanupPanel({
  target,
  description,
  isRunning,
  dryRun,
  setDryRun,
  hasCheckpoint,
  checkpointDryRun,
  checkpointProcessed,
  progress,
  datasetCounts,
  stats,
  logs,
  results,
  onRun,
  onResume,
  onUpdateCheckpoint,
  getStatusIcon,
  getStatusBadge,
}: CleanupPanelProps) {
  const [editProcessed, setEditProcessed] = useState<string>('');
  const [showEditCheckpoint, setShowEditCheckpoint] = useState(false);

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {target === 'destinations' ? 'Destination' : target === 'attractions' ? 'Attraction' : 'Local Knowledge'} Cleanup
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="dry-run">Dry Run Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Preview changes without saving
                </p>
              </div>
              <Switch
                id="dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
                disabled={isRunning}
              />
            </div>

            <Button 
              onClick={onRun} 
              disabled={isRunning}
              className="w-full"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {dryRun ? 'Preview Cleanup' : 'Run Cleanup'}
                </>
              )}
            </Button>

            {hasCheckpoint && !isRunning && (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResume}
                  className="w-full"
                >
                  {checkpointDryRun === true
                    ? 'Resume Dry Run'
                    : checkpointDryRun === false
                      ? 'Resume Run'
                      : 'Resume'}
                </Button>
                
                {/* Show checkpoint info and allow editing */}
                <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Checkpoint: {checkpointProcessed ?? 0} processed</span>
                    {onUpdateCheckpoint && (
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => {
                          setEditProcessed(String(checkpointProcessed ?? 0));
                          setShowEditCheckpoint(!showEditCheckpoint);
                        }}
                      >
                        {showEditCheckpoint ? 'Cancel' : 'Edit'}
                      </button>
                    )}
                  </div>
                  
                  {showEditCheckpoint && onUpdateCheckpoint && (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editProcessed}
                        onChange={(e) => setEditProcessed(e.target.value)}
                        className="flex-1 px-2 py-1 rounded border bg-background text-sm"
                        placeholder="Processed count"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const num = parseInt(editProcessed, 10);
                          if (!isNaN(num) && num >= 0) {
                            onUpdateCheckpoint(num);
                            setShowEditCheckpoint(false);
                          }
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              If your browser crashes or you refresh mid-run, use "Resume" to continue from the last saved batch.
            </p>

            {dryRun && (
              <p className="text-xs text-muted-foreground">
                Dry run doesn't save changes to the database.
              </p>
            )}

            {progress.total > 0 && (
              <div className="space-y-3">
                {target === 'attractions' && datasetCounts && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-muted/50 p-2">
                      <div className="text-muted-foreground">Total records</div>
                      <div className="font-semibold">{datasetCounts.total}</div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <div className="text-muted-foreground">Clean (not dirty)</div>
                      <div className="font-semibold">{datasetCounts.clean}</div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <div className="text-muted-foreground">Dirty remaining</div>
                      <div className="font-semibold">{datasetCounts.dirty}</div>
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Cleaned (dirty → clean)</span>
                  <span className="text-green-600 font-semibold">
                    {progress.current} / {progress.total} dirty
                  </span>
                </div>
                <Progress value={(progress.current / progress.total) * 100} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Remaining dirty: ~{progress.remaining}</span>
                  <span>{Math.round((progress.current / progress.total) * 100)}% complete</span>
                </div>
                {!dryRun && target === 'attractions' && (
                  <div className="text-[11px] text-muted-foreground">
                    Note: “Attempts” can be higher than total if some records fail and get retried.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.updated}</div>
                <div className="text-sm text-muted-foreground">Updated</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-muted-foreground">{stats.clean}</div>
                <div className="text-sm text-muted-foreground">Already Clean</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-destructive">{stats.errors}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{stats.processed}</div>
                <div className="text-sm text-muted-foreground">Attempts</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {logs.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 max-h-48 overflow-y-auto font-mono text-sm">
              {logs.map((log, i) => (
                <div key={i} className="py-0.5">{log}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Detailed Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result) => (
                <div 
                  key={result.id} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.city || result.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(result.status)}
                    {result.changes && Object.keys(result.changes).length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {Object.keys(result.changes).length} fields
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
