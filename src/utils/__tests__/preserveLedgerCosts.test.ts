import { describe, it, expect } from 'vitest';
import { preserveLedgerCosts } from '../preserveLedgerCosts';

const day = (acts: any[]) => ({ activities: acts });

describe('preserveLedgerCosts', () => {
  it('restores ledger-protected cost when next is lower', () => {
    const prev = [day([{ id: 'a', cost: { amount: 500, currency: 'USD', basis: 'repair_floor', source: 'michelin_floor' } }])];
    const next = [day([{ id: 'a', cost: { amount: 30, currency: 'USD' } }])];
    const out = preserveLedgerCosts(prev, next);
    expect(out[0].activities[0].cost.amount).toBe(500);
  });

  it('keeps user raises above the ledger floor', () => {
    const prev = [day([{ id: 'a', cost: { amount: 500, basis: 'repair_floor' } }])];
    const next = [day([{ id: 'a', cost: { amount: 800, basis: 'user_override' } }])];
    const out = preserveLedgerCosts(prev, next);
    expect(out[0].activities[0].cost.amount).toBe(800);
  });

  it('does not touch unprotected activities', () => {
    const prev = [day([{ id: 'a', cost: { amount: 100 } }])];
    const next = [day([{ id: 'a', cost: { amount: 0 } }])];
    const out = preserveLedgerCosts(prev, next);
    expect(out[0].activities[0].cost.amount).toBe(0);
  });

  it('handles missing prev gracefully', () => {
    const next = [day([{ id: 'a', cost: { amount: 10 } }])];
    expect(preserveLedgerCosts(null, next)).toBe(next);
  });
});
