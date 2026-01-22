import { useCallback, useState, useEffect } from "react";
import type { CleanupStats } from "./cleanupTypes";

export type CleanupTarget = 'destinations' | 'attractions' | 'local-knowledge';

type CleanupCheckpoint = {
  dryRun: boolean;
  offset: number;
  processedTotal: number;
  totalCount: number;
  stats: CleanupStats;
  updatedAt: string;
};

function getStorageKey(target: CleanupTarget): string {
  return `admin.${target}Cleanup.checkpoint.v1`;
}

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

// Keep the second arg optional for backwards-compat with older call sites/types.
export function useCleanupCheckpoint(target: CleanupTarget, _dryRun?: boolean) {
  const [checkpoint, setCheckpoint] = useState<CleanupCheckpoint | null>(null);
  const storageKey = getStorageKey(target);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    const parsed = safeParse(raw);
    // Load whatever checkpoint exists for this target (dry or live).
    setCheckpoint(parsed);
  }, [storageKey]);

  const hasCheckpoint = !!checkpoint;

  const saveCheckpoint = useCallback((next: Omit<CleanupCheckpoint, "updatedAt">) => {
    if (typeof window === "undefined") return;
    const payload: CleanupCheckpoint = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    setCheckpoint(payload);
  }, [storageKey]);

  const clearCheckpoint = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(storageKey);
    setCheckpoint(null);
  }, [storageKey]);

  return {
    checkpoint,
    hasCheckpoint,
    saveCheckpoint,
    clearCheckpoint,
  };
}
