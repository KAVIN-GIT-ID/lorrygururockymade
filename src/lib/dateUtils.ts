export const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const formatDate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
  return dateStr;
};

export const calculateDaysLeft = (dateStr?: string, anchorDate?: Date): number | null => {
  if (!dateStr) return null;
  const today = anchorDate || new Date();
  today.setHours(0, 0, 0, 0);
  
  let targetDate: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    targetDate = parseLocalDate(dateStr);
  } else {
    targetDate = new Date(dateStr);
  }
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return isNaN(diffDays) ? null : diffDays;
};

export const getOutstandingAge = (dateStr?: string, anchorDate?: Date): number => {
  if (!dateStr) return 0;
  const today = anchorDate || new Date();
  today.setHours(0, 0, 0, 0);
  
  let tripDate: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    tripDate = parseLocalDate(dateStr);
  } else {
    tripDate = new Date(dateStr);
  }
  tripDate.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - tripDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return isNaN(diffDays) ? 0 : Math.max(0, diffDays);
};
