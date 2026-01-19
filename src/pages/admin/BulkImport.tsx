import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, CheckCircle, XCircle, Loader2, Users, Trash2, ShieldAlert } from "lucide-react";
import { readCSVFile, bulkImportCSV } from "@/utils/csvBulkImport";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ImportStatus {
  total: number;
  imported: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
}

export default function BulkImport() {
  const navigate = useNavigate();
  const [table, setTable] = useState<string>("activities");
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [userImportResult, setUserImportResult] = useState<any>(null);
  const [deleteResult, setDeleteResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check admin role using server-side validation
  const { data: isAdmin, isLoading: isCheckingAdmin, error: adminError } = useQuery({
    queryKey: ['admin-check'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      // Check user_roles table for admin role
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) {
        console.error('Admin check error:', error);
        return false;
      }
      
      return !!data;
    },
    staleTime: 30000, // Cache for 30 seconds
    retry: 1,
  });

  // Redirect non-admins
  useEffect(() => {
    if (!isCheckingAdmin && !isAdmin) {
      toast.error("Admin access required");
      navigate('/');
    }
  }, [isCheckingAdmin, isAdmin, navigate]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setStatus(null);
      setUserImportResult(null);
      setDeleteResult(null);
    }
  };

  const handleDeleteUsers = async () => {
    if (!confirm("Are you sure you want to delete ALL users? This cannot be undone!")) {
      return;
    }

    setIsDeleting(true);
    setDeleteResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('delete-users', {
        body: {}
      });

      if (error) {
        toast.error(`Delete failed: ${error.message}`);
        setDeleteResult({ error: error.message });
      } else {
        setDeleteResult(data);
        toast.success(`Deleted ${data.deleted} users. You can now re-import.`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Delete failed";
      toast.error(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a CSV file");
      return;
    }

    setIsImporting(true);
    setResult(null);
    setStatus(null);
    setUserImportResult(null);
    setDeleteResult(null);

    try {
      toast.info(`Reading ${file.name}...`);
      const csvData = await readCSVFile(file);
      
      if (csvData.length === 0) {
        toast.error("No data found in CSV file");
        setIsImporting(false);
        return;
      }

      // Special handling for users import
      if (table === "users") {
        toast.info(`Found ${csvData.length} users. Starting import via edge function...`);
        
        const { data, error } = await supabase.functions.invoke('import-users', {
          body: { users: csvData }
        });

        if (error) {
          toast.error(`Import failed: ${error.message}`);
          setUserImportResult({ error: error.message });
        } else {
          setUserImportResult(data);
          if (data.failed === 0) {
            toast.success(`Successfully imported ${data.imported} users!`);
          } else {
            toast.warning(`Imported ${data.imported} users, ${data.failed} failed, ${data.skipped} skipped`);
          }
        }
        setIsImporting(false);
        return;
      }

      toast.info(`Found ${csvData.length} rows. Starting import...`);

      const importResult = await bulkImportCSV(
        table,
        csvData,
        100, // batch size
        (progress) => setStatus(progress)
      );

      setResult(importResult);
      
      if (importResult.failed === 0) {
        toast.success(`Successfully imported ${importResult.success} rows!`);
      } else {
        toast.warning(`Imported ${importResult.success} rows, ${importResult.failed} failed`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Import failed";
      toast.error(errorMsg);
      console.error("Import error:", err);
    } finally {
      setIsImporting(false);
    }
  };

  const progressPercent = status 
    ? Math.round((status.imported + status.failed) / status.total * 100) 
    : 0;

  // Show loading state while checking admin
  if (isCheckingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You need admin privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Bulk Data Import</h1>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Import CSV Data</CardTitle>
            <CardDescription>
              Upload a CSV file to import data into the database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Target Table</label>
              <Select value={table} onValueChange={setTable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="users">👤 Users (Auth + Profile)</SelectItem>
                  <SelectItem value="trips">✈️ Trips</SelectItem>
                  <SelectItem value="activities">Activities</SelectItem>
                  <SelectItem value="attractions">Attractions</SelectItem>
                  <SelectItem value="guides">Guides</SelectItem>
                  <SelectItem value="destinations">Destinations</SelectItem>
                  <SelectItem value="airports">Airports</SelectItem>
                  <SelectItem value="destination_images">Destination Images</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">CSV File</label>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span>{file.name}</span>
                    <span className="text-muted-foreground text-sm">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p>Click to select a CSV file</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleImport} 
                disabled={!file || isImporting || isDeleting}
                className="flex-1"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Start Import
                  </>
                )}
              </Button>
              
              {table === "users" && (
                <Button 
                  onClick={handleDeleteUsers} 
                  disabled={isImporting || isDeleting}
                  variant="destructive"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete All Users
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {status && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Import Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progressPercent} />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Batch {status.currentBatch} of {status.totalBatches}</span>
                <span>{status.imported + status.failed} / {status.total} rows</span>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{status.imported} imported</span>
                </div>
                {status.failed > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>{status.failed} failed</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Import Complete</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-green-600">✓ {result.success} rows imported successfully</p>
                {result.failed > 0 && (
                  <>
                    <p className="text-red-600">✗ {result.failed} rows failed</p>
                    <div className="mt-4">
                      <p className="font-medium mb-2">Errors:</p>
                      <ul className="text-sm text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                        {result.errors.slice(0, 10).map((error, i) => (
                          <li key={i}>• {error}</li>
                        ))}
                        {result.errors.length > 10 && (
                          <li>... and {result.errors.length - 10} more errors</li>
                        )}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {userImportResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Import Complete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userImportResult.error ? (
                  <p className="text-red-600">✗ Error: {userImportResult.error}</p>
                ) : (
                  <>
                    <p className="text-green-600">✓ {userImportResult.imported} users imported successfully</p>
                    {userImportResult.skipped > 0 && (
                      <p className="text-yellow-600">⏭ {userImportResult.skipped} users skipped (already exist)</p>
                    )}
                    {userImportResult.failed > 0 && (
                      <p className="text-red-600">✗ {userImportResult.failed} users failed</p>
                    )}
                    
                    {userImportResult.details?.failed?.length > 0 && (
                      <div className="mt-4">
                        <p className="font-medium mb-2">Failed:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                          {userImportResult.details.failed.slice(0, 10).map((f: any, i: number) => (
                            <li key={i}>• {f.email}: {f.error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {userImportResult.details?.skipped?.length > 0 && (
                      <div className="mt-4">
                        <p className="font-medium mb-2">Skipped:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                          {userImportResult.details.skipped.slice(0, 5).map((s: any, i: number) => (
                            <li key={i}>• {s.email}: {s.reason}</li>
                          ))}
                          {userImportResult.details.skipped.length > 5 && (
                            <li>... and {userImportResult.details.skipped.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {deleteResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Users Deleted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deleteResult.error ? (
                  <p className="text-red-600">✗ Error: {deleteResult.error}</p>
                ) : (
                  <>
                    <p className="text-green-600">✓ {deleteResult.deleted} users deleted</p>
                    {deleteResult.failed > 0 && (
                      <p className="text-red-600">✗ {deleteResult.failed} failed to delete</p>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
