import { describe, it, expect } from 'vitest';
import { isWeakAddress } from '../address-quality';

describe('isWeakAddress', () => {
  it('flags null / empty / whitespace as weak', () => {
    expect(isWeakAddress(null)).toBe(true);
    expect(isWeakAddress(undefined)).toBe(true);
    expect(isWeakAddress('')).toBe(true);
    expect(isWeakAddress('   ')).toBe(true);
  });

  it('flags bare neighborhoods / sestieri as weak', () => {
    expect(isWeakAddress('San Marco')).toBe(true);
    expect(isWeakAddress('Cannaregio')).toBe(true);
    expect(isWeakAddress('trastevere')).toBe(true);
    expect(isWeakAddress('Le Marais')).toBe(true);
    expect(isWeakAddress('Shibuya')).toBe(true);
    expect(isWeakAddress('Centro Storico')).toBe(true);
  });

  it('flags addresses without any digit as weak', () => {
    expect(isWeakAddress('Piazza San Marco, Venezia')).toBe(true);
    expect(isWeakAddress('Rue de Rivoli, Paris')).toBe(true);
  });

  it('passes real street addresses with numbers', () => {
    expect(isWeakAddress('Piazza San Marco 121, 30124 Venezia VE, Italy')).toBe(false);
    expect(isWeakAddress('228 Rue de Rivoli, 75001 Paris')).toBe(false);
    expect(isWeakAddress('Via del Corso 12, 00186 Roma RM')).toBe(false);
  });
});
