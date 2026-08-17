/**
 * Parses any date string supporting both ISO (YYYY-MM-DD) and Indian (DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY) formats.
 */
export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr || typeof dateStr !== 'string') return new Date(NaN);
  const clean = dateStr.trim();

  // If ISO string with time component (T or :), use native Date
  if (clean.includes('T') || clean.includes(':')) {
    return new Date(clean);
  }

  // YYYY-MM-DD format
  if (/^\d{4}[-/. ]\d{1,2}[-/. ]\d{1,2}$/.test(clean)) {
    const parts = clean.split(/[-/. ]/).map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY format (Indian Standard)
  if (/^\d{1,2}[-/. ]\d{1,2}[-/. ]\d{4}$/.test(clean)) {
    const parts = clean.split(/[-/. ]/).map(Number);
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }

  return new Date(clean);
};

export const formatDate = (date: Date): string => {
  if (isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Normalizes any valid ISO or Indian formatted date string to standard YYYY-MM-DD.
 */
export const normalizeToISODate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parsed = parseLocalDate(dateStr);
  if (isNaN(parsed.getTime())) return dateStr;
  return formatDate(parsed);
};

/**
 * Checks if two date strings represent the same date regardless of DD-MM-YYYY vs YYYY-MM-DD formatting.
 */
export const isSameDateFlexible = (d1?: string, d2?: string): boolean => {
  if (!d1 || !d2) return false;
  if (d1 === d2) return true;
  const iso1 = normalizeToISODate(d1);
  const iso2 = normalizeToISODate(d2);
  return !!iso1 && iso1 === iso2;
};

export const getTodayStr = (anchorDate?: Date): string => {
  const date = anchorDate || new Date();
  return formatDate(date);
};

export const formatToDisplayDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [yyyy, mm, dd] = dateStr.split('-');
    return `${dd}-${mm}-${yyyy}`;
  }
  if (/^\d{1,2}[-/. ]\d{1,2}[-/. ]\d{4}$/.test(dateStr)) {
    const parsed = parseLocalDate(dateStr);
    if (!isNaN(parsed.getTime())) {
      const dd = String(parsed.getDate()).padStart(2, '0');
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const yyyy = parsed.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
  }
  return dateStr;
};

export const calculateDaysLeft = (dateStr?: string, anchorDate?: Date): number | null => {
  if (!dateStr) return null;
  const today = anchorDate || new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetDate = parseLocalDate(dateStr);
  if (isNaN(targetDate.getTime())) return null;
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return isNaN(diffDays) ? null : diffDays;
};

export const getOutstandingAge = (dateStr?: string, anchorDate?: Date): number => {
  if (!dateStr) return 0;
  const today = anchorDate || new Date();
  today.setHours(0, 0, 0, 0);
  
  const tripDate = parseLocalDate(dateStr);
  if (isNaN(tripDate.getTime())) return 0;
  tripDate.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - tripDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return isNaN(diffDays) ? 0 : Math.max(0, diffDays);
};
