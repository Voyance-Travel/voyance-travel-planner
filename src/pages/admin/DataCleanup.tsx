import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, AlertCircle, Database, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MainLayout from '@/components/layout/MainLayout';

interface CleanupResult {
  id: string;
  city: string;
  status: string;
  changes?: Record<string, unknown>;
}

interface CleanupResponse {
  message: string;
  dryRun: boolean;
  processed: number;
  offset: number;
  nextOffset: number;
  complete?: boolean;
  results: CleanupResult[];
}

export default function DataCleanup() {
  const [isRunning, setIsRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [results, setResults] = useState<CleanupResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState({ updated: 0, clean: 0, errors: 0, processed: 0 });
  const [, startTransition] = useTransition();

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

  const runCleanup = async () => {
    setIsRunning(true);
    setResults([]);
    setLogs([]);
    setProgress({ current: 0, total: 0 });
    setStats({ updated: 0, clean: 0, errors: 0, processed: 0 });

    // First, get total count
    const { count } = await supabase
      .from('destinations')
      .select('*', { count: 'exact', head: true });
    
    const totalCount = count || 0;
    setProgress({ current: 0, total: totalCount });
    addLog(`Starting cleanup of ${totalCount} destinations (${dryRun ? 'DRY RUN' : 'LIVE'})`);

    let offset = 0;
    const batchSize = 3;
    let processedTotal = 0;

    try {
      while (true) {
        addLog(`Processing batch starting at offset ${offset}...`);
        
        const { data, error } = await supabase.functions.invoke('cleanup-destinations', {
          body: { batchSize, offset, dryRun }
        });

        if (error) {
          addLog(`Error: ${error.message}`);
          toast.error(`Cleanup failed: ${error.message}`);
          break;
        }

        const response = data as CleanupResponse;

        // Update stats + UI in one render pass to avoid UI lockups
        const batchUpdated = response.results.filter(r => r.status === 'updated' || r.status === 'would_update').length;
        const batchClean = response.results.filter(r => r.status === 'no_changes_needed').length;
        const batchErrors = response.results.filter(r => r.status === 'error').length;
        processedTotal += response.processed;

        startTransition(() => {
          setStats(prev => ({
            updated: prev.updated + batchUpdated,
            clean: prev.clean + batchClean,
            errors: prev.errors + batchErrors,
            processed: prev.processed + response.processed,
          }));

          setResults(prev => {
            const next = [...prev, ...response.results];
            return next.length > MAX_RESULTS ? next.slice(-MAX_RESULTS) : next;
          });

          setProgress({ current: processedTotal, total: totalCount });
        });

        // Log individual results (batch to reduce re-renders)
        const batchLogs: string[] = [];
        response.results.forEach(r => {
          if (r.status === 'updated' || r.status === 'would_update') {
            batchLogs.push(`✓ ${r.city}: ${r.status}`);
          } else if (r.status === 'error') {
            batchLogs.push(`✗ ${r.city}: error`);
          }
        });
        addLogs(batchLogs);
        
        if (response.complete) {
          addLog('All destinations processed!');
          break;
        }

        offset = response.nextOffset;

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      toast.success(`Cleanup complete! Processed ${processedTotal} destinations.`);
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
            Destination Data Cleanup
          </h1>
          <p className="text-muted-foreground mt-2">
            Use AI to clean and improve destination data quality
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Control Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Cleanup Controls
              </CardTitle>
              <CardDescription>
                Configure and run the AI-powered data cleanup
              </CardDescription>
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
                onClick={runCleanup} 
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

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Results Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                      {stats.updated}
                  </div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-muted-foreground">
                      {stats.clean}
                  </div>
                  <div className="text-sm text-muted-foreground">Already Clean</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-destructive">
                      {stats.errors}
                  </div>
                  <div className="text-sm text-muted-foreground">Errors</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                      {stats.processed}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Processed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs */}
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

        {/* Results Detail */}
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
                      <span className="font-medium">{result.city}</span>
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
      </div>
    </MainLayout>
  );
}
