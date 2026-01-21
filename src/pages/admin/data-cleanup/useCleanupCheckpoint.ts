import { useCallback, useState, useEffect } from "react";
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
  // Use state + effect to read checkpoint, ensuring consistent hook count
  const [checkpoint, setCheckpoint] = useState<CleanupCheckpoint | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = safeParse(raw);
    if (!parsed || !parsed.dryRun || parsed.dryRun !== dryRun) {
      setCheckpoint(null);
      return;
    }
    setCheckpoint(parsed);
  }, [dryRun]);

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
