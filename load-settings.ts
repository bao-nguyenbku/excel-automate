import fs from 'fs';
import path from 'path';
import type { WorkflowEnv } from './cypress/types';

export type LogOccurrence = 'always' | 'onFail' | 'never';

const SETTINGS_FILE = 'settings.txt';

/** Parse `KEY=value` lines (same format as a simple .env file). */
function parseSettingsTxt(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function get(raw: Record<string, string>, key: string, fallback = ''): string {
  const v = raw[key];
  return v === undefined ? fallback : v;
}

function getInt(raw: Record<string, string>, key: string, fallback: number): number {
  const v = get(raw, key);
  if (v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getSliceEnd(raw: Record<string, string>): number | '' | undefined {
  const v = get(raw, 'DATA_ROW_SLICE_END');
  if (v === '' || /^end$/i.test(v)) return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseLogOccurrence(value: string, fallback: LogOccurrence): LogOccurrence {
  const v = value.trim().toLowerCase();
  if (v === 'always') return 'always';
  if (v === 'onfail') return 'onFail';
  if (v === 'never') return 'never';
  return fallback;
}

function parseBool(value: string, fallback: boolean): boolean {
  if (value === '') return fallback;
  return /^(1|true|yes)$/i.test(value);
}

function readRaw(projectRoot: string): Record<string, string> {
  const filePath = path.join(projectRoot, SETTINGS_FILE);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${SETTINGS_FILE}. Create it at the project root (see README).`);
  }
  return parseSettingsTxt(fs.readFileSync(filePath, 'utf8'));
}

export interface AppSettings {
  loginUrl: string;
  loginEmail: string;
  loginPassword: string;
  programLinkText: string;
  excelRelativePath: string;
  excelLogRelativePath: string;
  excelDataStartRow: number;
  dataRowSliceStart: number;
  dataRowSliceEnd: number | '' | undefined;
  filterProjectId: string;
  terminalLog: LogOccurrence;
  terminalLogToFile: LogOccurrence;
  terminalLogLive: boolean;
}

export function loadSettings(projectRoot: string): AppSettings {
  const raw = readRaw(projectRoot);

  const terminalLog = parseLogOccurrence(get(raw, 'CYPRESS_TERMINAL_LOG'), 'onFail');
  const terminalLogToFile = parseLogOccurrence(
    get(raw, 'CYPRESS_TERMINAL_LOG_FILE'),
    terminalLog === 'always' ? 'always' : 'onFail',
  );
  const terminalLogLive = parseBool(get(raw, 'CYPRESS_TERMINAL_LOG_LIVE'), terminalLog === 'always');

  return {
    loginUrl: get(raw, 'LOGIN_URL', 'https://app.regrow.ag/mrv/login?redirect=/mrv/admin/programs'),
    loginEmail: get(raw, 'LOGIN_EMAIL'),
    loginPassword: get(raw, 'LOGIN_PASSWORD'),
    programLinkText: get(raw, 'PROGRAM_LINK_TEXT', 'Vietnam TRVC Rice Season 5'),
    excelRelativePath: get(raw, 'EXCEL_RELATIVE_PATH', 'cypress/fixtures/TRVC_VietNgaGroup_TEST.xlsx'),
    excelLogRelativePath: get(raw, 'EXCEL_LOG_RELATIVE_PATH', 'cypress/fixtures/run-log.xlsx'),
    excelDataStartRow: getInt(raw, 'EXCEL_DATA_START_ROW', 3),
    dataRowSliceStart: getInt(raw, 'DATA_ROW_SLICE_START', 2),
    dataRowSliceEnd: getSliceEnd(raw),
    filterProjectId: get(raw, 'FILTER_PROJECT_ID'),
    terminalLog,
    terminalLogToFile,
    terminalLogLive,
  };
}

export function toCypressEnv(settings: AppSettings): WorkflowEnv {
  return {
    loginUrl: settings.loginUrl,
    loginEmail: settings.loginEmail,
    loginPassword: settings.loginPassword,
    programLinkText: settings.programLinkText,
    excelRelativePath: settings.excelRelativePath,
    excelLogRelativePath: settings.excelLogRelativePath,
    excelDataStartRow: settings.excelDataStartRow,
    dataRowSliceStart: settings.dataRowSliceStart,
    dataRowSliceEnd: settings.dataRowSliceEnd,
    filterProjectId: settings.filterProjectId,
    terminalLogLive: settings.terminalLogLive,
  };
}

const projectRoot = path.resolve(__dirname);

export const settings = loadSettings(projectRoot);
export const cypressEnv = toCypressEnv(settings);
