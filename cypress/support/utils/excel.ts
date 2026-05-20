import type { ExcelRow } from '../../types';

export const resolveSliceEnd = (value: unknown, defaultExclusiveEnd: number): number | undefined => {
  if (value === undefined || value === null) {
    return defaultExclusiveEnd;
  }
  if (value === '') {
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Expected numeric dataRowSliceEnd or '', got: ${JSON.stringify(value)}`);
  }
  return n;
};

export const swapVietnameseName = (fullName: unknown): string => {
  const name = String(fullName ?? '').trim();
  const parts = name.split(/\s+/);
  if (parts.length <= 1) return name;
  const lastName = parts.shift();
  return [...parts, lastName!].join(' ');
};

export const buildLogHeaders = (row0: ExcelRow, row1: ExcelRow, colCount: number): string[] =>
  Array.from({ length: colCount }, (_, i) => {
    const a = row0[i];
    const b = row1[i];
    const sa = a != null && String(a).trim() !== '' ? String(a).trim() : '';
    const sb = b != null && String(b).trim() !== '' ? String(b).trim() : '';
    if (sa && sb) {
      return `${sa} | ${sb}`;
    }
    return sa || sb || `Column ${i + 1}`;
  });
