import { describe, expect, it } from 'vitest';
import { formatGameNumber, formatGamePercent } from '../../src/game/formatNumbers';

describe('formatGameNumber', () => {
  it('shows integers without decimal', () => {
    expect(formatGameNumber(12)).toBe('12');
    expect(formatGameNumber(12.0)).toBe('12');
  });

  it('rounds to one decimal place', () => {
    expect(formatGameNumber(12.34)).toBe('12.3');
    expect(formatGameNumber(12.36)).toBe('12.4');
    expect(formatGameNumber(0.05)).toBe('0.1');
  });

  it('formats percent helper', () => {
    expect(formatGamePercent(0.456)).toBe('45.6%');
  });
});
