import { useState, useTransition, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle, XCircle, AlertCircle, Database, Sparkles, MapPin, Building } from 'lucide-react';
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
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState<CleanupStats>({ updated: 0, clean: 0, errors: 0, processed: 0 });
  const [, startTransition] = useTransition();

  const { checkpoint, hasCheckpoint, saveCheckpoint, clearCheckpoint } = useCleanupCheckpoint(activeTab, dryRun);

  const checkpointRef = useRef<{
    dryRun: boolean;
    offset: number;
    processedTotal: number;
    totalCount: number;
    stats: CleanupStats;
  } | null>(null);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isRunning && dryRun && checkpointRef.current) {
        saveCheckpoint(checkpointRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRunning, dryRun, saveCheckpoint]);

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

  const runCleanup = async (target: CleanupTarget, opts?: { resume?: boolean }) => {
    const resume = !!opts?.resume;

    setIsRunning(true);
    setResults([]);
    setLogs([]);
    setProgress({ current: 0, total: 0 });
    setStats({ updated: 0, clean: 0, errors: 0, processed: 0 });

    // Get total count based on target
    let totalCount = 0;
    if (target === 'destinations') {
      const { count } = await supabase
        .from('destinations')
        .select('*', { count: 'exact', head: true })
        .or('currency_code.is.null,timezone.is.null,cost_tier.is.null');
      totalCount = count || 0;
    } else {
      const { count } = await supabase
        .from('attractions')
        .select('*', { count: 'exact', head: true })
        .or('description.ilike.Popular %,latitude.lt.1,latitude.gt.-1');
      totalCount = count || 0;
    }
    
    setProgress({ current: 0, total: totalCount });
    addLog(`Starting ${target} cleanup of ${totalCount} items (${dryRun ? 'DRY RUN' : 'LIVE'})`);

    const shouldResume = dryRun && resume && checkpoint;
    if (!shouldResume) {
      clearCheckpoint();
    }

    let offset = shouldResume ? checkpoint.offset : 0;
    const batchSize = 3;
    let processedTotal = shouldResume ? checkpoint.processedTotal : 0;
    let statsTotal: CleanupStats = shouldResume
      ? checkpoint!.stats
      : { updated: 0, clean: 0, errors: 0, processed: 0 };

    if (shouldResume) {
      setStats(statsTotal);
      setProgress({ current: processedTotal, total: totalCount });
      addLog(`Resuming dry run from offset ${offset} (processed ${processedTotal}/${totalCount})`);
    }

    const functionName = target === 'destinations' ? 'cleanup-destinations' : 'cleanup-attractions';

    try {
      while (true) {
        addLog(`Processing batch starting at offset ${offset}...`);
        
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { batchSize, offset, dryRun }
        });

        if (error) {
          addLog(`Error: ${error.message}`);
          toast.error(`Cleanup failed: ${error.message}`);
          break;
        }

        const response = data as CleanupResponse;

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

        if (dryRun) {
          checkpointRef.current = {
            dryRun,
            offset: response.nextOffset ?? offset + batchSize,
            processedTotal,
            totalCount,
            stats: statsTotal,
          };
          saveCheckpoint(checkpointRef.current);
        }

        startTransition(() => {
          setStats(statsTotal);

          setResults(prev => {
            const next = [...prev, ...response.results];
            return next.length > MAX_RESULTS ? next.slice(-MAX_RESULTS) : next;
          });

          setProgress({ current: processedTotal, total: totalCount });
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
          if (dryRun) {
            clearCheckpoint();
            checkpointRef.current = null;
          }
          break;
        }

        offset = response.nextOffset;

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      toast.success(`Cleanup complete! Processed ${processedTotal} ${target}.`);
    } catch (err) {
      addLog(`Fatal error: ${err instanceof Error ? err.message : 'Unknown'}`);
      toast.error('Cleanup failed');
    } finally {
      setIsRunning(false);
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
          </TabsList>

          <TabsContent value="destinations">
            <CleanupPanel
              target="destinations"
              description="Clean destination data (currency, timezone, cost tier)"
              isRunning={isRunning}
              dryRun={dryRun}
              setDryRun={setDryRun}
              hasCheckpoint={hasCheckpoint}
              progress={progress}
              stats={stats}
              logs={logs}
              results={results}
              onRun={() => runCleanup('destinations')}
              onResume={() => runCleanup('destinations', { resume: true })}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>

          <TabsContent value="attractions">
            <CleanupPanel
              target="attractions"
              description="Clean attraction data (descriptions, coordinates, destination links)"
              isRunning={isRunning}
              dryRun={dryRun}
              setDryRun={setDryRun}
              hasCheckpoint={hasCheckpoint}
              progress={progress}
              stats={stats}
              logs={logs}
              results={results}
              onRun={() => runCleanup('attractions')}
              onResume={() => runCleanup('attractions', { resume: true })}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
            />
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
  progress: { current: number; total: number };
  stats: CleanupStats;
  logs: string[];
  results: CleanupResult[];
  onRun: () => void;
  onResume: () => void;
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
  progress,
  stats,
  logs,
  results,
  onRun,
  onResume,
  getStatusIcon,
  getStatusBadge,
}: CleanupPanelProps) {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {target === 'destinations' ? 'Destination' : 'Attraction'} Cleanup
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

            {dryRun && hasCheckpoint && !isRunning && (
              <Button
                type="button"
                variant="outline"
                onClick={onResume}
                className="w-full"
              >
                Resume Dry Run
              </Button>
            )}

            {dryRun && (
              <p className="text-xs text-muted-foreground">
                Dry run doesn't save changes to the database; use "Resume Dry Run" after a crash to avoid reprocessing.
              </p>
            )}

            {progress.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <Progress value={(progress.current / progress.total) * 100} />
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
                <div className="text-sm text-muted-foreground">Total Processed</div>
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
