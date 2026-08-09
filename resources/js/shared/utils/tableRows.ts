export type SortDirection = 'asc' | 'desc';

export type SortValue = string | number | null | undefined;

const isMissing = (value: SortValue): boolean => value === null || value === undefined;

export const compareValues = (a: string | number, b: string | number): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

export const sortRows = <T>(
  rows: T[],
  sortValue: (item: T) => SortValue,
  direction: SortDirection
): T[] => {
  const factor = direction === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = sortValue(left);
    const b = sortValue(right);
    if (isMissing(a)) return isMissing(b) ? 0 : 1;
    if (isMissing(b)) return -1;
    return factor * compareValues(a as string | number, b as string | number);
  });
};

export const filterRows = <T>(rows: T[], searchValue: (item: T) => string, query: string): T[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => searchValue(row).toLowerCase().includes(needle));
};

export const initialDirectionFor = <T>(
  rows: T[],
  sortValue: (item: T) => SortValue
): SortDirection => {
  const sample = rows.map(sortValue).find((value) => !isMissing(value));
  return typeof sample === 'number' ? 'desc' : 'asc';
};

export const timeValue = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};
