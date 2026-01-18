import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { readCSVFile, bulkImportCSV } from "@/utils/csvBulkImport";
import { toast } from "sonner";

interface ImportStatus {
  total: number;
  imported: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
}

export default function BulkImport() {
  const [table, setTable] = useState<string>("activities");
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setStatus(null);
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

    try {
      toast.info(`Reading ${file.name}...`);
      const csvData = await readCSVFile(file);
      
      if (csvData.length === 0) {
        toast.error("No data found in CSV file");
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

            <Button 
              onClick={handleImport} 
              disabled={!file || isImporting}
              className="w-full"
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
      </div>
    </div>
  );
}
