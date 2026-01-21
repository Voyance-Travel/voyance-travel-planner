export interface CleanupResult {
  id: string;
  city?: string;  // For destinations
  name?: string;  // For attractions
  status: string;
  changes?: Record<string, unknown>;
}

export interface CleanupResponse {
  message: string;
  dryRun: boolean;
  processed: number;
  offset: number;
  nextOffset: number;
  complete?: boolean;
  results: CleanupResult[];
  executionTimeMs?: number;
}

export interface CleanupStats {
  updated: number;
  clean: number;
  errors: number;
  processed: number;
}
