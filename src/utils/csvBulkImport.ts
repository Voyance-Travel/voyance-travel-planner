import { supabase } from "@/integrations/supabase/client";

interface ImportProgress {
  total: number;
  imported: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
}

type ProgressCallback = (progress: ImportProgress) => void;

/**
 * Parse CSV string into array of objects
 */
export function parseCSV(csvString: string): Record<string, string>[] {
  const lines = csvString.split('\n');
  if (lines.length < 2) return [];
  
  // Parse header row - handle quoted headers
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }
  
  return rows;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Import CSV data to Supabase in batches
 */
export async function bulkImportCSV(
  table: string,
  csvData: Record<string, string>[],
  batchSize: number = 100,
  onProgress?: ProgressCallback
): Promise<{ success: number; failed: number; errors: string[] }> {
  const totalBatches = Math.ceil(csvData.length / batchSize);
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < csvData.length; i += batchSize) {
    const batch = csvData.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    try {
      const { data, error } = await supabase.functions.invoke('bulk-import', {
        body: { table, rows: batch }
      });
      
      if (error) {
        console.error(`Batch ${batchNum} error:`, error);
        errors.push(`Batch ${batchNum}: ${error.message}`);
        failed += batch.length;
      } else {
        imported += batch.length;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Batch ${batchNum} exception:`, errorMsg);
      errors.push(`Batch ${batchNum}: ${errorMsg}`);
      failed += batch.length;
    }
    
    if (onProgress) {
      onProgress({
        total: csvData.length,
        imported,
        failed,
        currentBatch: batchNum,
        totalBatches
      });
    }
    
    // Small delay to avoid rate limiting
    if (i + batchSize < csvData.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return { success: imported, failed, errors };
}

/**
 * Read file and parse as CSV
 */
export async function readCSVFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
