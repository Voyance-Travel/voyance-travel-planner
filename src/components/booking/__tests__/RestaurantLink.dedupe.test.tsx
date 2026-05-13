/**
 * Stability tests for RestaurantLink:
 *   - Concurrent mounts share one in-flight invoke.
 *   - Unmounting before resolution still writes urlCache.
 *   - Failures populate the negative cache so subsequent mounts are silent.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { RestaurantLink, __testing } from '../RestaurantLink';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

describe('RestaurantLink stability', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    __testing.urlCache.clear();
    __testing.inflight.clear();
    if (typeof window !== 'undefined') window.sessionStorage.clear();
  });

  it('dedupes concurrent mounts to a single edge invoke', async () => {
    let resolveFn: (v: unknown) => void = () => {};
    invokeMock.mockReturnValue(
      new Promise((r) => {
        resolveFn = r;
      }),
    );

    render(<RestaurantLink restaurantName="L'Entrecôte" destination="Casablanca" />);
    render(<RestaurantLink restaurantName="L'Entrecôte" destination="Casablanca" />);
    render(<RestaurantLink restaurantName="L'Entrecôte" destination="Casablanca" />);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    resolveFn({ data: { success: true, url: 'https://lentrecote.example' } });

    await waitFor(() => {
      expect(__testing.urlCache.get(__testing.getCacheKey("L'Entrecôte", 'Casablanca'))?.url).toBe(
        'https://lentrecote.example',
      );
    });
  });

  it('writes cache even when subscriber unmounts before resolution', async () => {
    let resolveFn: (v: unknown) => void = () => {};
    invokeMock.mockReturnValue(
      new Promise((r) => {
        resolveFn = r;
      }),
    );

    const view = render(<RestaurantLink restaurantName="Basmane" destination="Casablanca" />);
    view.unmount();

    resolveFn({ data: { success: true, url: 'https://basmane.example' } });

    await waitFor(() => {
      const entry = __testing.urlCache.get(__testing.getCacheKey('Basmane', 'Casablanca'));
      expect(entry?.url).toBe('https://basmane.example');
    });
    cleanup();
  });

  it('caches null on edge error so next mount is silent (no spinner)', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const view = render(
      <RestaurantLink restaurantName="Blend Gourmet Burger" destination="Casablanca" />,
    );

    await waitFor(() => {
      const entry = __testing.urlCache.get(
        __testing.getCacheKey('Blend Gourmet Burger', 'Casablanca'),
      );
      expect(entry).toBeDefined();
      expect(entry?.url).toBeNull();
    });

    // Component renders nothing — no link, no spinner.
    expect(view.container.textContent).toBe('');

    // Second mount short-circuits (no extra invoke).
    invokeMock.mockClear();
    render(<RestaurantLink restaurantName="Blend Gourmet Burger" destination="Casablanca" />);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
