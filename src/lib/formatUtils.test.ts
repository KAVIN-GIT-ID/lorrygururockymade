import { describe, it, expect } from 'vitest';
import { formatTruckNumber } from './formatUtils';

describe('formatTruckNumber utility', () => {
  it('should format clean uppercase registration numbers', () => {
    expect(formatTruckNumber('TN52P5608')).toBe('TN52-P-5608');
    expect(formatTruckNumber('TN52AD3134')).toBe('TN52-AD-3134');
    expect(formatTruckNumber('MH12PQ1234')).toBe('MH12-PQ-1234');
  });

  it('should handle lowercase and various spacings/dashes', () => {
    expect(formatTruckNumber('tn52-p-5608')).toBe('TN52-P-5608');
    expect(formatTruckNumber('tn 52 ad 3134')).toBe('TN52-AD-3134');
    expect(formatTruckNumber('MH-12-PQ-1234')).toBe('MH12-PQ-1234');
    expect(formatTruckNumber('  ap 03  ab  9  ')).toBe('AP03-AB-9');
  });

  it('should support single digit district codes and varying series letter lengths', () => {
    expect(formatTruckNumber('DL1A5678')).toBe('DL1-A-5678');
    expect(formatTruckNumber('KA09MST999')).toBe('KA09-MST-999');
  });

  it('should return uppercase raw string if it does not match standard pattern', () => {
    expect(formatTruckNumber('INVALID')).toBe('INVALID');
    expect(formatTruckNumber('TN52')).toBe('TN52');
    expect(formatTruckNumber('TN52P')).toBe('TN52P');
    expect(formatTruckNumber('TN52P12345')).toBe('TN52P12345');
  });

  it('should handle empty input', () => {
    expect(formatTruckNumber('')).toBe('');
  });
});
