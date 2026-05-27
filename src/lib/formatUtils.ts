/**
 * Format raw truck numbers to standard Indian vehicle registration formats
 * Pattern: StateDistrict-Series-Number (e.g., TN52-P-5608, TN52-AD-3134)
 */
export const formatTruckNumber = (raw: string): string => {
  if (!raw) return '';
  
  // Strip all non-alphanumeric characters, convert to uppercase
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  // Regex to match standard Indian vehicle number formats:
  // Group 1: State Code (2 letters, e.g., TN)
  // Group 2: District Code (1-2 digits, e.g., 52 or 9)
  // Group 3: RTO Series Letters (1-3 letters, e.g., P, AD or MST)
  // Group 4: Number (1-4 digits, e.g., 5608)
  const regex = /^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{1,4})$/;
  const match = clean.match(regex);
  if (match) {
    return `${match[1]}${match[2]}-${match[3]}-${match[4]}`;
  }
  return raw.toUpperCase();
};
