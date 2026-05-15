/**
 * Verifies the page-load false-alarm fix:
 *  1. self-heal source events produce no toast
 *  2. user-source events produce a toast
 *  3. events fired before voyance:trip-loaded are buffered;
 *     self-heal ones are dropped on flip, user ones surface.
 *
 * See mem://constraints/itinerary/persist-issues-toast-user-only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React from 'react';
import { PersistIssuesListener } from '../PersistIssuesListener';

const errorSpy = vi.fn();
const warningSpy = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => errorSpy(...args),
    warning: (...args: unknown[]) => warningSpy(...args),
  },
}));

function dispatchPersistIssues(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('itinerary-persist-issues', { detail }));
}

function dispatchTripLoaded(tripId: string) {
  window.dispatchEvent(new CustomEvent('voyance:trip-loaded', { detail: { tripId } }));
}

const mealIssue = { code: 'MISSING_REQUIRED_MEAL', severity: 'error', dayNumber: 1, detail: 'Day 1 is missing breakfast.' };

describe('PersistIssuesListener — suppress self-heal toasts', () => {
  beforeEach(() => {
    errorSpy.mockClear();
    warningSpy.mockClear();
  });
  afterEach(() => cleanup());

  it('drops self-heal source events even after load', () => {
    render(<PersistIssuesListener />);
    act(() => dispatchTripLoaded('trip-A'));
    act(() => dispatchPersistIssues({
      tripId: 'trip-A',
      source: 'self-heal-predawn-cascade',
      errors: [mealIssue],
    }));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warningSpy).not.toHaveBeenCalled();
  });

  it('shows toast for user-initiated source after load', () => {
    render(<PersistIssuesListener />);
    act(() => dispatchTripLoaded('trip-B'));
    act(() => dispatchPersistIssues({
      tripId: 'trip-B',
      source: 'user',
      errors: [mealIssue],
    }));
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('buffers events before load, drops self-heal on flip, surfaces user', () => {
    render(<PersistIssuesListener />);
    // Pre-load: two events arrive
    act(() => dispatchPersistIssues({
      tripId: 'trip-C',
      source: 'self-heal-rebuild-from-tables',
      errors: [mealIssue],
    }));
    act(() => dispatchPersistIssues({
      tripId: 'trip-C',
      source: 'user',
      errors: [{ ...mealIssue, dayNumber: 2, detail: 'Day 2 is missing dinner.' }],
    }));
    expect(errorSpy).not.toHaveBeenCalled();
    // Flip
    act(() => dispatchTripLoaded('trip-C'));
    // self-heal dropped, user surfaced
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
