import { describe, it, expect } from 'vitest';
import {
  parseLocalDate,
  formatDate,
  getTodayStr,
  formatToDisplayDate,
  calculateDaysLeft,
  getOutstandingAge,
} from './dateUtils';

describe('dateUtils Unit Tests', () => {
  describe('parseLocalDate', () => {
    it('should parse YYYY-MM-DD string into correct local Date object', () => {
      const date = parseLocalDate('2026-05-27');
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(4); // 0-indexed May
      expect(date.getDate()).toBe(27);
    });

    it('should parse Indian format DD-MM-YYYY, DD/MM/YYYY, and DD.MM.YYYY correctly', () => {
      const d1 = parseLocalDate('27-05-2026');
      expect(d1.getFullYear()).toBe(2026);
      expect(d1.getMonth()).toBe(4);
      expect(d1.getDate()).toBe(27);

      const d2 = parseLocalDate('05/08/2026');
      expect(d2.getFullYear()).toBe(2026);
      expect(d2.getMonth()).toBe(7); // August
      expect(d2.getDate()).toBe(5);

      const d3 = parseLocalDate('05.08.2026');
      expect(d3.getFullYear()).toBe(2026);
      expect(d3.getMonth()).toBe(7);
      expect(d3.getDate()).toBe(5);
    });
  });

  describe('formatDate', () => {
    it('should format a Date object into YYYY-MM-DD string', () => {
      const date = new Date(2026, 4, 27); // May 27, 2026
      expect(formatDate(date)).toBe('2026-05-27');
    });
  });

  describe('getTodayStr', () => {
    it('should return YYYY-MM-DD string of current date or anchor date', () => {
      const anchor = new Date(2026, 4, 27);
      expect(getTodayStr(anchor)).toBe('2026-05-27');
    });
  });

  describe('formatToDisplayDate', () => {
    it('should return display format DD-MM-YYYY when YYYY-MM-DD is passed', () => {
      expect(formatToDisplayDate('2026-05-27')).toBe('27-05-2026');
    });

    it('should return the original string if it is not in YYYY-MM-DD format', () => {
      expect(formatToDisplayDate('May 27, 2026')).toBe('May 27, 2026');
    });

    it('should return "—" if undefined or empty', () => {
      expect(formatToDisplayDate()).toBe('—');
      expect(formatToDisplayDate('')).toBe('—');
    });
  });

  describe('calculateDaysLeft', () => {
    const anchor = new Date(2026, 4, 27); // May 27, 2026

    it('should return null if dateStr is not provided', () => {
      expect(calculateDaysLeft(undefined, anchor)).toBeNull();
    });

    it('should calculate positive days remaining', () => {
      // May 30 - May 27 = 3 days
      expect(calculateDaysLeft('2026-05-30', anchor)).toBe(3);
    });

    it('should calculate negative days if target date is in the past', () => {
      // May 24 - May 27 = -3 days
      expect(calculateDaysLeft('2026-05-24', anchor)).toBe(-3);
    });

    it('should return 0 if target date is today', () => {
      expect(calculateDaysLeft('2026-05-27', anchor)).toBe(0);
    });

    it('should support alternative date string formats', () => {
      expect(calculateDaysLeft('2026-05-30T00:00:00Z', anchor)).toBe(3);
    });
  });

  describe('getOutstandingAge', () => {
    const anchor = new Date(2026, 4, 27); // May 27, 2026

    it('should return 0 if dateStr is not provided', () => {
      expect(getOutstandingAge(undefined, anchor)).toBe(0);
    });

    it('should calculate days passed since trip date (positive age)', () => {
      // May 27 - May 24 = 3 days
      expect(getOutstandingAge('2026-05-24', anchor)).toBe(3);
    });

    it('should return 0 if trip date is today', () => {
      expect(getOutstandingAge('2026-05-27', anchor)).toBe(0);
    });

    it('should return 0 if trip date is in the future', () => {
      expect(getOutstandingAge('2026-05-30', anchor)).toBe(0);
    });
  });
});
