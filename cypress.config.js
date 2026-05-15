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
  /** Per-command default (ms). Raise if you see “Timed out retrying…” on slow UI. */
  defaultCommandTimeout: 15000,
  /** `cy.visit` / page transitions (ms). */
  pageLoadTimeout: 120000,
  /** `cy.task` (e.g. Excel read/write) must finish within this (ms). */
  taskTimeout: 180000,
  /**
   * Long batch runs (20+ min): reduces Cypress runner / snapshot memory.
   * In `cypress open`, keeps fewer past tests in memory (helps multi-`it` specs).
   */
  numTestsKeptInMemory: 0,
  /** Chromium GC between tests; helps long headed runs. */
  experimentalMemoryManagement: true,
  video: false,
  screenshotOnRunFailure: true,
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
      on("before:browser:launch", (browser, launchOptions) => {
        if (browser.family === "chromium") {
          launchOptions.args.push(
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disable-dev-shm-usage",
          );
        }
        return launchOptions;
      });
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
         * Appends one row to a run log .xlsx: same columns as `rowValues`, plus `Finished` and `Error`.
         * Creates the file with a header row if it does not exist.
         * Older logs without an `Error` column get that column added on the next append.
         * @param {{ relativePath: string, headers: string[], rowValues: unknown[], finished: boolean, errorMessage?: string }} opts
         */
        appendExcelRunLog(opts) {
          const relativePath = opts?.relativePath;
          const headers = opts?.headers;
          const rowValues = opts?.rowValues;
          const finished = opts?.finished === true;
          const errorMessage =
            opts?.errorMessage != null && String(opts.errorMessage).trim() !== ""
              ? String(opts.errorMessage).trim()
              : "";
          if (!relativePath) {
            throw new Error("appendExcelRunLog: relativePath is required");
          }
          if (!Array.isArray(headers) || !headers.length) {
            throw new Error(
              "appendExcelRunLog: headers must be a non-empty array",
            );
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

          const ensureErrorColumn = (existing) => {
            if (!existing.length) return existing;
            const headerRow = existing[0];
            if (headerRow[headerRow.length - 1] === "Error") {
              return existing;
            }
            headerRow.push("Error");
            for (let r = 1; r < existing.length; r++) {
              if (!existing[r]) existing[r] = [];
              existing[r].push("");
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
          const line = [
            ...padded.slice(0, headers.length),
            finished ? "Yes" : "No",
            errorMessage,
          ];
          const headerLine = [...headers, "Finished", "Error"];
          const sheetName = "Run log";

          if (fs.existsSync(absPath)) {
            const workbook = XLSX.readFile(absPath);
            const name = workbook.SheetNames[0] || sheetName;
            const sheet = workbook.Sheets[name];
            let existing = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: null,
            });
            existing = ensureErrorColumn(existing);
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
