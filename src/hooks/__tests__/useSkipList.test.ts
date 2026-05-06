/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSkipList } from '../useSkipList';

const invokeMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: any[]) => invokeMock(...args) } },
}));

describe('useSkipList', () => {
  beforeEach(() => {
    sessionStorage.clear();
    invokeMock.mockReset();
  });

  it('filters out entries missing name or reason', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        skippedItems: [
          { name: 'Good', reason: 'because' },
          { name: '', reason: 'no name' },
          { name: 'NoReason' },
          { reason: 'orphan' },
        ],
      },
      error: null,
    });
    const { result } = renderHook(() => useSkipList('atlantis'));
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    await waitFor(() => {
      expect(result.current.skippedItems.length).toBe(1);
      expect(result.current.skippedItems[0].name).toBe('Good');
    });
    expect(JSON.parse(sessionStorage.getItem('voyance_skiplist_atlantis')!)).toHaveLength(1);
  });

  it('does not cache an empty array when AI returns invalid items', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { skippedItems: [{ name: '' }, { reason: 'orphan' }] },
      error: null,
    });
    const { result } = renderHook(() => useSkipList('atlantis'));
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    // Hardcoded fallback for unknown destination is empty, but we did NOT cache
    expect(sessionStorage.getItem('voyance_skiplist_atlantis')).toBeNull();
    expect(result.current.skippedItems).toEqual([]);
  });

  it('uses hardcoded fallback when AI fetch errors', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useSkipList('paris'));
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    // Paris has hardcoded entries
    expect(result.current.skippedItems.length).toBeGreaterThan(0);
  });
});
