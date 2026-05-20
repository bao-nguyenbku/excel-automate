export type ExcelCell = string | number | null;
export type ExcelRow = ExcelCell[];

export interface ExcelSheet {
  name: string;
  rows: ExcelRow[];
}

export interface ExcelWorkbook {
  relativePath: string;
  sheetNames: string[];
  sheets: ExcelSheet[];
}

export type SurveyFieldKind = 'dropdown' | 'yesNo' | 'text' | 'optionalText' | 'date';

export interface SurveyColIdx {
  a1aColIdx: number;
  a1bColIdx: number;
  a1cColIdx: number;
  a2ColIdx: number;
  a3ColIdx: number;
  a4ColIdx: number;
  a4aColIdx: number;
  a4bColIdx: number;
  a5ColIdx: number;
  a6ColIdx: number;
  a7ColIdx: number;
  a8ColIdx: number;
  c4ColIdx: number;
  c5ColIdx: number;
}

export interface SurveyFieldSpec {
  kind: SurveyFieldKind;
  colKey: keyof SurveyColIdx;
}

export interface LoginCredentials {
  loginUrl: string;
  loginEmail: string;
  loginPassword: string;
}

export interface WorkflowEnv extends LoginCredentials {
  programLinkText: string;
  excelRelativePath: string;
  excelLogRelativePath: string;
  excelDataStartRow: number;
  dataRowSliceStart: number;
  dataRowSliceEnd: number | '' | undefined;
  filterProjectId: string;
  terminalLogLive: boolean;
}

export interface AppendExcelRunLogOptions {
  relativePath: string;
  headers: string[];
  rowValues: unknown[];
  finished: boolean;
  errorMessage?: string;
}

export type ClickLoginAsWhenNotEnrolledProps = {
  names: string[];
  phoneNumber: string;
};

export type PendingRowLog = {
  row: ExcelRow;
  logHeaders: string[];
  cfg: WorkflowEnv;
  index: number;
  projectIdColIdx: number;
};
