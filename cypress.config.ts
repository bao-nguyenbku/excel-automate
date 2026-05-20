import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { defineConfig } from 'cypress';
import type { AppendExcelRunLogOptions, ExcelWorkbook } from './cypress/types';
import { cypressEnv, settings } from './load-settings';

const terminalLogToConsole = settings.terminalLog;
const terminalLogToFile = settings.terminalLogToFile;

export default defineConfig({
  allowCypressEnv: true,
  viewportWidth: 1600,
  viewportHeight: 900,
  defaultCommandTimeout: 15000,
  pageLoadTimeout: 120000,
  taskTimeout: 180000,
  numTestsKeptInMemory: 0,
  experimentalMemoryManagement: true,
  video: false,
  screenshotOnRunFailure: true,
  chromeWebSecurity: false,
  defaultBrowser: 'chrome',
  e2e: {
    env: cypressEnv,
    setupNodeEvents(on, config) {
      // Mirror Cypress command log in the terminal during `cypress run`.
      // Pair with CYPRESS_NO_COMMAND_LOG=1 so output is not duplicated/suppressed.
      //
      // Workaround: enableContinuousLogging passes continuous:true, but consoleProcessor
      // only prints output.substring(-1) (last character). Force full lines to the terminal.
      const consoleProcessor = require('cypress-terminal-report/src/outputProcessor/consoleProcessor');
      const printLogsToTerminal = consoleProcessor.default;
      consoleProcessor.default = (
        messages: unknown,
        options: unknown,
        data: { continuous?: boolean } & Record<string, unknown>,
      ) => {
        printLogsToTerminal(messages, options, { ...data, continuous: false });
      };

      require('cypress-terminal-report/src/installLogsPrinter')(on, {
        printLogsToConsole: terminalLogToConsole,
        printLogsToFile: terminalLogToFile,
        outputRoot: path.join(config.projectRoot, 'cypress/logs'),
        outputTarget: {
          'terminal-log.txt': 'txt',
        },
      });
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium') {
          launchOptions.args.push(
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-dev-shm-usage',
          );
        }
        return launchOptions;
      });
      on('task', {
        readExcelFile(opts: { relativePath?: string }): ExcelWorkbook {
          const relativePath = opts?.relativePath;
          if (!relativePath) {
            throw new Error('readExcelFile: relativePath is required');
          }
          const absPath = path.join(config.projectRoot, relativePath);
          const workbook = XLSX.readFile(absPath, { cellDates: true });
          const sheets = workbook.SheetNames.map((name) => {
            const sheet = workbook.Sheets[name];
            const rows = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: null,
              raw: false,
            }) as unknown[][];
            return {
              name,
              rows: rows.map((row) =>
                Array.isArray(row)
                  ? row.map((cell) => {
                      if (cell instanceof Date) {
                        return cell.toISOString();
                      }
                      return cell as string | number | null;
                    })
                  : [],
              ),
            };
          }).filter((sheet) => sheet.name === 'Dữ liệu GEDSI');
          return {
            relativePath,
            sheetNames: workbook.SheetNames.filter((name) => name === 'Dữ liệu GEDSI'),
            sheets,
          };
        },
        appendExcelRunLog(opts: AppendExcelRunLogOptions): null {
          const relativePath = opts?.relativePath;
          const headers = opts?.headers;
          const rowValues = opts?.rowValues;
          const finished = opts?.finished === true;
          const errorMessage =
            opts?.errorMessage != null && String(opts.errorMessage).trim() !== ''
              ? String(opts.errorMessage).trim()
              : '';
          if (!relativePath) {
            throw new Error('appendExcelRunLog: relativePath is required');
          }
          if (!Array.isArray(headers) || !headers.length) {
            throw new Error('appendExcelRunLog: headers must be a non-empty array');
          }
          if (!Array.isArray(rowValues)) {
            throw new Error('appendExcelRunLog: rowValues must be an array');
          }

          const normalizeCell = (cell: unknown) => {
            if (cell instanceof Date) {
              return cell.toISOString();
            }
            return cell;
          };

          const ensureErrorColumn = (existing: unknown[][]) => {
            if (!existing.length) return existing;
            const headerRow = existing[0] as unknown[];
            if (headerRow[headerRow.length - 1] === 'Error') {
              return existing;
            }
            headerRow.push('Error');
            for (let r = 1; r < existing.length; r++) {
              if (!existing[r]) existing[r] = [];
              (existing[r] as unknown[]).push('');
            }
            return existing;
          };

          const absPath = path.join(config.projectRoot, relativePath);
          const dir = path.dirname(absPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          const padded = rowValues.map(normalizeCell);
          while (padded.length < headers.length) {
            padded.push(null);
          }
          const line = [...padded.slice(0, headers.length), finished ? 'Yes' : 'No', errorMessage];
          const headerLine = [...headers, 'Finished', 'Error'];
          const sheetName = 'Run log';

          if (fs.existsSync(absPath)) {
            const workbook = XLSX.readFile(absPath);
            const name = workbook.SheetNames[0] || sheetName;
            const sheet = workbook.Sheets[name];
            let existing = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: null,
            }) as unknown[][];
            existing = ensureErrorColumn(existing);
            existing.push(line);
            workbook.Sheets[name] = XLSX.utils.aoa_to_sheet(existing);
            XLSX.writeFile(workbook, absPath);
          } else {
            const workbook = XLSX.utils.book_new();
            const aoa = [headerLine, line];
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), sheetName);
            XLSX.writeFile(workbook, absPath);
          }
          return null;
        },
      });
    },
  },
  expose: cypressEnv,
});
