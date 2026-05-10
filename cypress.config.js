const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const XLSX = require("xlsx");
const { defineConfig } = require("cypress");

/** Fallbacks if a key is omitted from `.env`. */
const ENV_DEFAULTS = {
  loginUrl: "https://app.regrow.ag/mrv/login?redirect=/mrv/admin/programs",
  loginEmail: "",
  loginPassword: "",
  programLinkText: "Vietnam TRVC Rice Season 5",
  excelRelativePath: "cypress/fixtures/TRVC_VietNgaGroup_TEST.xlsx",
  excelDataStartRow: 3,
  dataRowSliceStart: 2,
  dataRowSliceEnd: 30,
  filterProjectId: "",
  excelLogRelativePath: "cypress/fixtures/run-log.xlsx",
};

/** @param {string} name @param {string} fallback */
const fromEnvStr = (name, fallback) => {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v;
};

/** @param {string} name @param {number} fallback */
const fromEnvInt = (name, fallback) => {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
};

/**
 * DATA_ROW_SLICE_END: number (exclusive), or empty / "end" → slice through last row.
 * @param {number|string} fallback
 */
const fromEnvSliceEnd = (fallback) => {
  const v = process.env.DATA_ROW_SLICE_END;
  if (v === undefined) return fallback;
  const t = String(v).trim();
  if (t === "" || /^end$/i.test(t)) return "";
  const n = Number(t);
  if (!Number.isFinite(n)) return fallback;
  return n;
};

module.exports = defineConfig({
  allowCypressEnv: true,
  viewportWidth: 1600,
  viewportHeight: 900,
  defaultCommandTimeout: 10000,
  chromeWebSecurity: false,
  defaultBrowser: "chrome",
  e2e: {
    env: {
      loginUrl: fromEnvStr("LOGIN_URL", ENV_DEFAULTS.loginUrl),
      loginEmail: fromEnvStr("LOGIN_EMAIL", ENV_DEFAULTS.loginEmail),
      loginPassword: fromEnvStr("LOGIN_PASSWORD", ENV_DEFAULTS.loginPassword),
      programLinkText: fromEnvStr(
        "PROGRAM_LINK_TEXT",
        ENV_DEFAULTS.programLinkText,
      ),
      excelRelativePath: fromEnvStr(
        "EXCEL_RELATIVE_PATH",
        ENV_DEFAULTS.excelRelativePath,
      ),
      excelDataStartRow: fromEnvInt(
        "EXCEL_DATA_START_ROW",
        ENV_DEFAULTS.excelDataStartRow,
      ),
      dataRowSliceStart: fromEnvInt(
        "DATA_ROW_SLICE_START",
        ENV_DEFAULTS.dataRowSliceStart,
      ),
      dataRowSliceEnd: fromEnvSliceEnd(ENV_DEFAULTS.dataRowSliceEnd),
      filterProjectId: fromEnvStr(
        "FILTER_PROJECT_ID",
        ENV_DEFAULTS.filterProjectId,
      ),
      excelLogRelativePath: fromEnvStr(
        "EXCEL_LOG_RELATIVE_PATH",
        ENV_DEFAULTS.excelLogRelativePath,
      ),
    },
    setupNodeEvents(on, config) {
      on("task", {
        /**
         * Reads full .xlsx content: every sheet as a 2D array (row-major), including header rows.
         * @param {{ relativePath: string }} opts
         * @returns {{ relativePath: string, sheetNames: string[], sheets: { name: string, rows: (string|number|null)[][] }[] }}
         */
        readExcelFile(opts) {
          const relativePath = opts?.relativePath;
          if (!relativePath) {
            throw new Error("readExcelFile: relativePath is required");
          }
          const absPath = path.join(config.projectRoot, relativePath);
          const workbook = XLSX.readFile(absPath, { cellDates: true });
          const sheets = workbook.SheetNames.map((name) => {
            const sheet = workbook.Sheets[name];
            const rows = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: null,
              raw: false,
            });
            return {
              name,
              rows: rows.map((row) =>
                Array.isArray(row)
                  ? row.map((cell) => {
                      if (cell instanceof Date) {
                        return cell.toISOString();
                      }
                      return cell;
                    })
                  : [],
              ),
            };
          }).filter((sheet) => sheet.name === "Dữ liệu GEDSI");
          return {
            relativePath,
            sheetNames: workbook.SheetNames.filter(
              (name) => name === "Dữ liệu GEDSI",
            ),
            sheets,
          };
        },
        /**
         * Appends one row to a run log .xlsx: same columns as `rowValues`, plus `Finished`.
         * Creates the file with a header row if it does not exist.
         * @param {{ relativePath: string, headers: string[], rowValues: unknown[], finished: boolean }} opts
         */
        appendExcelRunLog(opts) {
          const relativePath = opts?.relativePath;
          const headers = opts?.headers;
          const rowValues = opts?.rowValues;
          const finished = opts?.finished === true;
          if (!relativePath) {
            throw new Error("appendExcelRunLog: relativePath is required");
          }
          if (!Array.isArray(headers) || !headers.length) {
            throw new Error("appendExcelRunLog: headers must be a non-empty array");
          }
          if (!Array.isArray(rowValues)) {
            throw new Error("appendExcelRunLog: rowValues must be an array");
          }

          const normalizeCell = (cell) => {
            if (cell instanceof Date) {
              return cell.toISOString();
            }
            return cell;
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
          const line = [...padded.slice(0, headers.length), finished ? "Yes" : "No"];
          const headerLine = [...headers, "Finished"];
          const sheetName = "Run log";

          if (fs.existsSync(absPath)) {
            const workbook = XLSX.readFile(absPath);
            const name = workbook.SheetNames[0] || sheetName;
            const sheet = workbook.Sheets[name];
            const existing = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: null,
            });
            existing.push(line);
            workbook.Sheets[name] = XLSX.utils.aoa_to_sheet(existing);
            XLSX.writeFile(workbook, absPath);
          } else {
            const workbook = XLSX.utils.book_new();
            const aoa = [headerLine, line];
            XLSX.utils.book_append_sheet(
              workbook,
              XLSX.utils.aoa_to_sheet(aoa),
              sheetName,
            );
            XLSX.writeFile(workbook, absPath);
          }
          return null;
        },
      });
    },
  },
});
