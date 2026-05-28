import { describe, it, expect } from 'vitest';
import { parseSpokenNumber, matchClosestOption, LevenshteinDistance, normalizeString } from './speechUtils';

describe('Speech Utilities Unit Tests', () => {
  describe('LevenshteinDistance', () => {
    it('should calculate Levenshtein distance correctly', () => {
      expect(LevenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(LevenshteinDistance('mumbai', 'mumbai')).toBe(0);
      expect(LevenshteinDistance('mumbai', 'pune')).toBe(5);
    });
  });

  describe('parseSpokenNumber', () => {
    it('should parse direct digit strings', () => {
      expect(parseSpokenNumber('55000')).toBe(55000);
      expect(parseSpokenNumber('40,000')).toBe(40000);
    });

    it('should parse text numbers in English', () => {
      expect(parseSpokenNumber('fifty five thousand')).toBe(55000);
      expect(parseSpokenNumber('five thousand four hundred')).toBe(5400);
    });

    it('should parse Indian numbering systems (Lakh/Crore)', () => {
      expect(parseSpokenNumber('one lakh fifty thousand')).toBe(150000);
      expect(parseSpokenNumber('two lakhs')).toBe(200000);
      expect(parseSpokenNumber('three crore')).toBe(30000000);
    });

    it('should parse Hindi Devanagari and transliterated numbers', () => {
      expect(parseSpokenNumber('पचास हजार')).toBe(50000);
      expect(parseSpokenNumber('एक लाख सत्तर हजार')).toBe(170000);
      expect(parseSpokenNumber('pachas hazar')).toBe(50000);
      expect(parseSpokenNumber('ek lakh sattar hazar')).toBe(170000);
    });

    it('should ignore words like rupees and kms', () => {
      expect(parseSpokenNumber('forty thousand rupees')).toBe(40000);
      expect(parseSpokenNumber('five hundred rs')).toBe(500);
      expect(parseSpokenNumber('sixty thousand kms')).toBe(60000);
    });

    it('should return null for invalid text', () => {
      expect(parseSpokenNumber('invalid text')).toBeNull();
      expect(parseSpokenNumber('hello world')).toBeNull();
    });
  });

  describe('normalizeString', () => {
    it('should clean spaces, punctuation and translate simple number words', () => {
      expect(normalizeString('MH-12-1234')).toBe('mh121234');
      expect(normalizeString('MH twelve twelve thirty four')).toBe('mh121234');
    });
  });

  describe('matchClosestOption', () => {
    const trucks = ['MH-12-1234', 'KA-01-9999', 'DL-03-8888'];
    const drivers = ['Rahul Sharma', 'Karan Singh', 'Amit Verma'];
    const offices = ['Mumbai HQ', 'Delhi Hub', 'Bangalore Branch'];

    it('should find exact matches', () => {
      expect(matchClosestOption('KA-01-9999', trucks)).toBe('KA-01-9999');
      expect(matchClosestOption('Rahul Sharma', drivers)).toBe('Rahul Sharma');
    });

    it('should find exact matches ignoring casing and dashes', () => {
      expect(matchClosestOption('ka019999', trucks)).toBe('KA-01-9999');
      expect(matchClosestOption('mh 12 1234', trucks)).toBe('MH-12-1234');
    });

    it('should find matches through phonetic text translation', () => {
      expect(matchClosestOption('MH twelve twelve thirty four', trucks)).toBe('MH-12-1234');
    });

    it('should find matches via Levenshtein distance for fuzzy matches', () => {
      // Small typo: "Rahl Sharma" instead of "Rahul Sharma"
      expect(matchClosestOption('Rahl Sharma', drivers)).toBe('Rahul Sharma');
      // Substring match
      expect(matchClosestOption('mumbai', offices)).toBe('Mumbai HQ');
    });

    it('should return null if no good match is found', () => {
      expect(matchClosestOption('unrelated text', trucks)).toBeNull();
    });
  });
});
