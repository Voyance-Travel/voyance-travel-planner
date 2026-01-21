import { useCallback } from "react";
import type { CleanupStats } from "./cleanupTypes";

type CleanupCheckpoint = {
  dryRun: boolean;
  offset: number;
  processedTotal: number;
  totalCount: number;
  stats: CleanupStats;
  updatedAt: string;
};

const STORAGE_KEY = "admin.destinationCleanup.checkpoint.v1";

function safeParse(raw: string | null): CleanupCheckpoint | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CleanupCheckpoint;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.offset !== "number" ||
      typeof parsed.processedTotal !== "number" ||
      typeof parsed.totalCount !== "number" ||
      typeof parsed.dryRun !== "boolean" ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.stats !== "object" ||
      parsed.stats === null
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function useCleanupCheckpoint(dryRun: boolean) {
  // Read checkpoint fresh on each call to ensure we catch any saved state
  const getCheckpoint = (): CleanupCheckpoint | null => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = safeParse(raw);
    if (!parsed) return null;
    // Only allow resuming dry-runs; live runs should rely on DB filters.
    if (!parsed.dryRun) return null;
    if (parsed.dryRun !== dryRun) return null;
    return parsed;
  };

  const checkpoint = getCheckpoint();
  const hasCheckpoint = !!checkpoint;

  const saveCheckpoint = useCallback((next: Omit<CleanupCheckpoint, "updatedAt">) => {
    if (typeof window === "undefined") return;
    const payload: CleanupCheckpoint = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, []);

  const clearCheckpoint = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    checkpoint,
    hasCheckpoint,
    saveCheckpoint,
    clearCheckpoint,
  };
}
