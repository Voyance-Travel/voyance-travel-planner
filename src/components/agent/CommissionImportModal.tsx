/**
 * Commission Import Modal
 * 
 * Allows agents to import commission data from external sources:
 * - CSV file upload
 * - Manual entry
 * - Paste from spreadsheet
 */

import { useState, useCallback } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  createCommissionImport,
  processCommissionImport,
  formatCurrency,
} from '@/services/financeSubledgerAPI';

interface CommissionLine {
  id: string;
  description: string;
  amountCents: number;
  tripId?: string;
  segmentId?: string;
  reference?: string;
  effectiveDate?: string;
}

interface CommissionImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const COMMISSION_SOURCES = [
  { value: 'viator', label: 'Viator' },
  { value: 'host_agency', label: 'Host Agency' },
  { value: 'hotel_direct', label: 'Hotel Direct' },
  { value: 'cruise_line', label: 'Cruise Line' },
  { value: 'tour_operator', label: 'Tour Operator' },
  { value: 'airline', label: 'Airline' },
  { value: 'other', label: 'Other' },
];

export default function CommissionImportModal({
  open,
  onOpenChange,
  onSuccess,
}: CommissionImportModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [source, setSource] = useState('viator');
  const [sourceReference, setSourceReference] = useState('');
  const [lines, setLines] = useState<CommissionLine[]>([]);
  const [pasteData, setPasteData] = useState('');

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: crypto.randomUUID(),
        description: '',
        amountCents: 0,
        effectiveDate: new Date().toISOString().split('T')[0],
      },
    ]);
  };

  const removeLine = (id: string) => {
    setLines(lines.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, updates: Partial<CommissionLine>) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsedLines = parseCSV(text);
        setLines(parsedLines);
        toast({
          title: 'File parsed',
          description: `Found ${parsedLines.length} commission lines`,
        });
      } catch (err) {
        toast({
          title: 'Parse error',
          description: 'Could not parse the CSV file',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
  }, []);

  const handlePaste = () => {
    if (!pasteData.trim()) return;

    try {
      const parsedLines = parseCSV(pasteData);
      setLines(parsedLines);
      setPasteData('');
      toast({
        title: 'Data parsed',
        description: `Found ${parsedLines.length} commission lines`,
      });
    } catch (err) {
      toast({
        title: 'Parse error',
        description: 'Could not parse the pasted data',
        variant: 'destructive',
      });
    }
  };

  const parseCSV = (text: string): CommissionLine[] => {
    const rows = text.trim().split('\n');
    return rows
      .map((row, index) => {
        const cols = row.split(/[,\t]/);
        if (cols.length < 2) return null;

        // Try to parse: description, amount, [date], [reference]
        const description = cols[0]?.trim() || `Commission Line ${index + 1}`;
        const amountStr = cols[1]?.trim().replace(/[$,]/g, '') || '0';
        const amount = parseFloat(amountStr);
        
        if (isNaN(amount)) return null;

        return {
          id: crypto.randomUUID(),
          description,
          amountCents: Math.round(amount * 100),
          effectiveDate: cols[2]?.trim() || new Date().toISOString().split('T')[0],
          reference: cols[3]?.trim(),
        } as CommissionLine;
      })
      .filter((l): l is CommissionLine => l !== null);
  };

  const totalAmount = lines.reduce((sum, l) => sum + l.amountCents, 0);

  const handleImport = async () => {
    if (lines.length === 0) {
      toast({
        title: 'No data',
        description: 'Add at least one commission line to import',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Create the import record
      const importRecord = await createCommissionImport({
        source,
        sourceReference: sourceReference || undefined,
        rawData: lines,
      });

      // Process the lines
      const result = await processCommissionImport(importRecord.id, lines);

      toast({
        title: 'Import complete',
        description: `Imported ${lines.length} lines (${result.matched} matched, ${result.unmatched} unmatched)`,
      });

      onSuccess?.();
      onOpenChange(false);
      setLines([]);
      setSourceReference('');
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Commissions
          </DialogTitle>
          <DialogDescription>
            Import commission payments from external sources like Viator, host agencies, or hotels
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="csv">CSV Upload</TabsTrigger>
            <TabsTrigger value="paste">Paste Data</TabsTrigger>
          </TabsList>

          {/* Source Selection */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Commission Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMISSION_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference / Report ID (optional)</Label>
              <Input
                value={sourceReference}
                onChange={(e) => setSourceReference(e.target.value)}
                placeholder="e.g., Report #12345"
              />
            </div>
          </div>

          <TabsContent value="manual" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {lines.length} line{lines.length !== 1 ? 's' : ''} • Total: {formatCurrency(totalAmount)}
                </p>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[120px]">Amount</TableHead>
                    <TableHead className="w-[130px]">Date</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Click "Add Line" to start entering commission data
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(line.id, { description: e.target.value })}
                            placeholder="Commission from..."
                          />
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              value={line.amountCents / 100}
                              onChange={(e) => updateLine(line.id, { 
                                amountCents: Math.round(parseFloat(e.target.value || '0') * 100) 
                              })}
                              className="pl-7"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={line.effectiveDate}
                            onChange={(e) => updateLine(line.id, { effectiveDate: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(line.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="csv" className="flex-1 mt-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">Upload a CSV file</p>
              <p className="text-xs text-muted-foreground mb-4">
                Format: Description, Amount, Date (optional), Reference (optional)
              </p>
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="max-w-xs mx-auto"
              />
            </div>
            {lines.length > 0 && (
              <div className="mt-4">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {lines.length} lines parsed • Total: {formatCurrency(totalAmount)}
                </Badge>
              </div>
            )}
          </TabsContent>

          <TabsContent value="paste" className="flex-1 mt-4 space-y-4">
            <div>
              <Label>Paste data from spreadsheet</Label>
              <Textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder="Description&#9;Amount&#9;Date&#10;Viator Tour Commission&#9;125.50&#9;2024-01-15"
                className="h-32 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tab-separated or comma-separated values
              </p>
            </div>
            <Button variant="outline" onClick={handlePaste} disabled={!pasteData.trim()}>
              Parse Data
            </Button>
            {lines.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {lines.length} lines parsed • Total: {formatCurrency(totalAmount)}
              </Badge>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm font-medium">
              Total: <span className="text-primary">{formatCurrency(totalAmount)}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={isProcessing || lines.length === 0}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Import {lines.length} Line{lines.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
