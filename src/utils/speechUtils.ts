/**
 * Speech utilities for the Voice Assistant.
 */

/**
 * Calculates the Levenshtein distance between two strings.
 */
export function LevenshteinDistance(s: string, t: string): number {
  if (s === t) return 0;
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;

  const v0 = new Array(t.length + 1);
  const v1 = new Array(t.length + 1);

  for (let i = 0; i < v0.length; i++) v0[i] = i;

  for (let i = 0; i < s.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < t.length; j++) {
      const cost = s[i] === t[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j < v0.length; j++) v0[j] = v1[j];
  }
  return v0[t.length];
}

/**
 * Translates text representation of digits/numbers to numeric digits.
 */
function textToDigits(text: string): string {
  const digits: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };

  const words = text.split(/\s+/);
  const result: string[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    const val = digits[w];
    if (val !== undefined) {
      // Check if this is a tens word (20, 30, ... 90) and the next word is a units word (1-9)
      if (val >= 20 && val <= 90 && i + 1 < words.length) {
        const nextWord = words[i + 1];
        const nextVal = digits[nextWord];
        if (nextVal !== undefined && nextVal >= 1 && nextVal <= 9) {
          result.push((val + nextVal).toString());
          i += 2;
          continue;
        }
      }
      result.push(val.toString());
      i++;
    } else {
      result.push(w);
      i++;
    }
  }
  return result.join(' ');
}

/**
 * Parses spoken numbers (including Indian counting terms like Lakh and Crore) into an actual number.
 */
export function parseSpokenNumber(text: string): number | null {
  if (!text) return null;

  // Clean formatting like commas, "rupees", "rupee", "rs", "kms", "km", "odometer" and Hindi equivalents
  // Preserve standard letters, digits, whitespace, and Devanagari unicode block (\u0900-\u097F)
  const cleaned = text.toLowerCase()
    .replace(/[^a-z0-9\s\u0900-\u097F]/gi, ' ')
    .replace(/\b(rupees|rupee|rs|kms|km|odometer|रुपये|रुपया|रू|किमी|किलोमीटर)\b/g, '')
    .trim();

  // If the cleaned text is direct digit representation, return it
  if (/^\d+$/.test(cleaned.replace(/\s+/g, ''))) {
    return parseInt(cleaned.replace(/\s+/g, ''), 10);
  }

  const words = cleaned.split(/\s+/);

  const numberWords: Record<string, number> = {
    // English
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    // Hindi Devanagari
    शून्य: 0, एक: 1, दो: 2, तीन: 3, चार: 4, पाँच: 5, पांच: 5, छह: 6, सात: 7, आठ: 8, नौ: 9,
    दस: 10, ग्यारह: 11, बारह: 12, तेरह: 13, चौदह: 14, पन्द्रह: 15, पंद्रह: 15, सोलह: 16,
    सत्रह: 17, अठारह: 18, उन्नीस: 19, बीस: 20, तीस: 30, चालीस: 40, पचास: 50, साठ: 60,
    sath: 60, सत्तर: 70, अस्सी: 80, नब्बे: 90,
    // Hindi Transliterated (Latin)
    ek: 1, do: 2, teen: 3, chaar: 4, char: 4, paanch: 5, panch: 5, chah: 6, cheh: 6, saat: 7, aath: 8, nau: 9, no: 9,
    das: 10, gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15, solah: 16,
    satrah: 17, atharah: 18, unnees: 19, bees: 20, tees: 30, chalis: 40, pachas: 50, saath: 60,
    sattar: 70, assee: 80, assi: 80, nabbe: 90, nabhah: 90
  };

  const scales: Record<string, number> = {
    // English
    hundred: 100,
    thousand: 1000,
    k: 1000,
    lakh: 100000,
    lakhs: 100000,
    lac: 100000,
    lacs: 100000,
    crore: 10000000,
    crores: 10000000,
    // Hindi Devanagari
    सौ: 100,
    हजार: 1000,
    हज़ार: 1000,
    लाख: 100000,
    करोड़: 10000000,
    करोड: 10000000,
    // Hindi Transliterated
    sau: 100,
    hazaar: 1000,
    hazar: 1000
  };

  let total = 0;
  let current = 0;
  let hasNumericValue = false;

  for (const word of words) {
    if (numberWords[word] !== undefined) {
      current += numberWords[word];
      hasNumericValue = true;
    } else if (scales[word] !== undefined) {
      const scale = scales[word];
      if (current === 0) current = 1;
      current *= scale;
      if (scale >= 1000) {
        total += current;
        current = 0;
      }
      hasNumericValue = true;
    } else if (/^\d+$/.test(word)) {
      current += parseInt(word, 10);
      hasNumericValue = true;
    }
  }

  total += current;

  return hasNumericValue ? total : null;
}

/**
 * Normalizes a string for robust fuzzy matching.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return textToDigits(str.toLowerCase())
    .replace(/[^a-z0-9]/g, '') // remove spaces, dashes, etc.
    .trim();
}

/**
 * Fuzzy matches a spoken option from a list of options.
 */
export function matchClosestOption(text: string, options: string[], type?: 'truck' | 'driver' | 'office' | 'city'): string | null {
  if (!text || !options || options.length === 0) return null;

  const normalizedInput = normalizeString(text);
  if (!normalizedInput) return null;

  // 1. Check for exact match on normalized strings
  for (const option of options) {
    if (normalizeString(option) === normalizedInput) {
      return option;
    }
  }

  // 2. Check if the input is a substring of the option or vice-versa
  for (const option of options) {
    const normalizedOption = normalizeString(option);
    if (normalizedOption.includes(normalizedInput) || normalizedInput.includes(normalizedOption)) {
      return option;
    }
  }

  // 3. Fallback to Levenshtein distance
  let bestMatch: string | null = null;
  let minDistance = Infinity;

  for (const option of options) {
    const normalizedOption = normalizeString(option);
    const distance = LevenshteinDistance(normalizedInput, normalizedOption);

    // Accept fuzzy match if distance is less than 30% of the option name length
    const limit = Math.max(3, Math.round(normalizedOption.length * 0.35));
    if (distance < minDistance && distance <= limit) {
      minDistance = distance;
      bestMatch = option;
    }
  }

  return bestMatch;
}
