import type { ExcelRow, SurveyColIdx } from '../../types';

const cellStr = (cell: unknown) => String(cell ?? '');

export interface SheetColumnIndices extends SurveyColIdx {
  projectIdColIdx: number;
  fullNameColIdx: number;
  phoneNumberColIdx: number;
}

export function findSheetColumnIndices(header: ExcelRow, firstRow: ExcelRow): SheetColumnIndices {
  const projectIdColIdx = header.findIndex((cell) => /Project ID/.test(cellStr(cell)));
  const fullNameColIdx = header.findIndex((cell) => /Full Name/.test(cellStr(cell)));
  const phoneNumberColIdx = header.findIndex((cell) => /SĐT|Phone Number/.test(cellStr(cell)));
  const a1aColIdx = firstRow.findIndex((cell) => /A1a/.test(cellStr(cell)));
  const a1bColIdx = firstRow.findIndex((cell) => /A1b/.test(cellStr(cell)));
  const a1cColIdx = firstRow.findIndex((cell) => /A1c/.test(cellStr(cell)));
  const a2ColIdx = firstRow.findIndex((cell) => /A2/.test(cellStr(cell)));
  const a3ColIdx = firstRow.findIndex((cell) => /A3/.test(cellStr(cell)));
  const a4ColIdx = firstRow.findIndex((cell) => /A4/.test(cellStr(cell)));
  const a4aColIdx = firstRow.findIndex((cell) => /A4a/.test(cellStr(cell)));
  const a4bColIdx = firstRow.findIndex((cell) => /A4b/.test(cellStr(cell)));
  const a5ColIdx = firstRow.findIndex((cell) => /A5/.test(cellStr(cell)));
  const a6ColIdx = firstRow.findIndex((cell) => /A6/.test(cellStr(cell)));
  const a7ColIdx = firstRow.findIndex((cell) => /A7/.test(cellStr(cell)));
  const a8ColIdx = firstRow.findIndex((cell) => /A8/.test(cellStr(cell)));
  const c4ColIdx = firstRow.findIndex((cell) => /C4/.test(cellStr(cell)));
  const c5ColIdx = firstRow.findIndex((cell) => /C5/.test(cellStr(cell)));

  if (projectIdColIdx === -1) {
    throw new Error('Project ID column not found');
  }

  return {
    projectIdColIdx,
    fullNameColIdx,
    phoneNumberColIdx,
    a1aColIdx,
    a1bColIdx,
    a1cColIdx,
    a2ColIdx,
    a3ColIdx,
    a4ColIdx,
    a4aColIdx,
    a4bColIdx,
    a5ColIdx,
    a6ColIdx,
    a7ColIdx,
    a8ColIdx,
    c4ColIdx,
    c5ColIdx,
  };
}
