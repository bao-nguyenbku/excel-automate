import type { ExcelRow, ExcelWorkbook, PendingRowLog, SurveyColIdx, WorkflowEnv } from '../types';
import {
  visitAndLoginWithCredentials,
  clickMenubarProfileAndStopUsingImpersonatedUser,
  clickIntendedPracticesUntilHeadingVisible,
  fillIntendedPracticesTableRows,
  getIframe,
  pollIntendedPracticesLockedAlert,
  pollIntendedPracticesStageAfterLogin,
  runIncompleteSurveyWithGuards,
  runSurveyFlowIfIncomplete,
  processFoundationFarmingAfterLogin,
} from '../support/helpers';
import { buildLogHeaders, resolveSliceEnd, swapVietnameseName } from '../support/utils/excel';
import { findSheetColumnIndices } from '../support/utils/sheet-columns';

describe('Automate input from excel', () => {
  // One `it` can run many Excel rows; allow long wall-clock time (ms)
  it('Full workflow', function () {
    this.timeout(45 * 60 * 1000);
    cy.env([
      'loginUrl',
      'loginEmail',
      'loginPassword',
      'programLinkText',
      'excelRelativePath',
      'excelLogRelativePath',
      'excelDataStartRow',
      'dataRowSliceStart',
      'dataRowSliceEnd',
      'filterProjectId',
    ]).then((cfg) => {
      const env = cfg as WorkflowEnv;
      const excelDataStartRow = env.excelDataStartRow;
      const dataRowSliceStart = env.dataRowSliceStart;
      const dataRowSliceEnd = resolveSliceEnd(env.dataRowSliceEnd, 30);
      const filterProjectId = String(env.filterProjectId ?? '').trim();

      // Step 1: Visit login page and login with credentials
      visitAndLoginWithCredentials(env);

      // Step 2: Click on the program link
      cy.contains('a', env.programLinkText).click();
      cy.get('.MuiCircularProgress-svg').should('not.exist');

      // Step 3: Read the Excel file
      cy.task<ExcelWorkbook>('readExcelFile', {
        relativePath: env.excelRelativePath,
      }).then((workbook) => {
        expect(workbook).to.have.keys('relativePath', 'sheetNames', 'sheets');
        expect(workbook.sheets).to.be.an('array');
        workbook.sheets.forEach((sheet) => {
          cy.log(`Sheet "${sheet.name}": ${sheet.rows.length} rows`);
        });

        // ------------ Preparation ------------
        const header = workbook.sheets[0].rows[1];
        const firstRow = workbook.sheets[0].rows[0];
        const {
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
        } = findSheetColumnIndices(header, firstRow);

        const dataRows = workbook.sheets[0].rows.slice(excelDataStartRow - 1);
        let rowsToRun: ExcelRow[];
        if (filterProjectId) {
          rowsToRun = dataRows.filter((r) => String(r[projectIdColIdx] ?? '').trim() === filterProjectId);
          cy.log(
            `filterProjectId=${filterProjectId}: ${rowsToRun.length} matching row(s) in sheet data (from row ${excelDataStartRow})`,
          );
        } else {
          rowsToRun =
            dataRowSliceEnd === undefined
              ? dataRows.slice(dataRowSliceStart - excelDataStartRow)
              : dataRows.slice(dataRowSliceStart - excelDataStartRow, dataRowSliceEnd - excelDataStartRow);
          cy.log(
            `Excel rows: sheet slice from ${excelDataStartRow}, run indices [${dataRowSliceStart}, ${dataRowSliceEnd === undefined ? 'end' : dataRowSliceEnd}) (${rowsToRun.length} rows)`,
          );
        }

        const logColCount = Math.max(header.length, firstRow.length, ...rowsToRun.map((r) => r.length));
        const logHeaders = buildLogHeaders(firstRow, header, logColCount);
        /** Set while a row's Cypress commands are running so `onRowFail` can log and continue. */
        let pendingRowLog: PendingRowLog | null = null;
        const stats = { success: 0, failed: 0, rowsLogged: 0 };
        // ------------ End of Preparation ------------

        function buildExcelRunRangeSummary() {
          if (!rowsToRun.length) {
            return filterProjectId ? `no rows matched filterProjectId=${filterProjectId}` : 'no rows in slice';
          }
          const excelRowNums = rowsToRun.map((r) => {
            const j = dataRows.indexOf(r);
            if (j === -1) return null;
            return excelDataStartRow + j;
          });
          const valid = excelRowNums.filter((n) => n != null);
          if (!valid.length) {
            return 'could not map rows to Excel line numbers';
          }
          const lo = Math.min(...valid);
          const hi = Math.max(...valid);
          const sliceHint = filterProjectId
            ? `filter=${filterProjectId}`
            : dataRowSliceEnd === undefined
              ? `slice [${dataRowSliceStart}, end)`
              : `slice [${dataRowSliceStart}, ${dataRowSliceEnd})`;
          if (lo === hi) {
            return `Excel 1-based row ${lo} (${sliceHint})`;
          }
          return `Excel 1-based rows ${lo}-${hi} (${rowsToRun.length} data rows, ${sliceHint})`;
        }

        /** Appends run log row and updates success/failed counters (success = finished + no errorMessage). */
        function appendExcelRunLogAndRecord(opts) {
          return cy.task('appendExcelRunLog', opts).then(() => {
            stats.rowsLogged += 1;
            const em = opts.errorMessage != null && String(opts.errorMessage).trim() !== '';
            if (opts.finished === true && !em) {
              stats.success += 1;
            } else {
              stats.failed += 1;
            }
          });
        }

        function onRowFail(err) {
          const ctx = pendingRowLog;
          if (!ctx) {
            return undefined;
          }
          pendingRowLog = null;
          const errMsg = err?.message ?? String(err);
          cy.log(`Cypress error for projectId ${ctx.row[ctx.projectIdColIdx]}: ${errMsg}`);
          const next = ctx.index + 1;
          setTimeout(() => {
            appendExcelRunLogAndRecord({
              relativePath: ctx.cfg.excelLogRelativePath,
              headers: ctx.logHeaders,
              rowValues: ctx.row,
              finished: false,
              errorMessage: errMsg,
            }).then(() => runFromIndex(next));
          }, 0);
          return false;
        }

        function runFromIndex(i: number) {
          if (i >= rowsToRun.length) {
            Cypress.off('fail', onRowFail);
            const rangeSummary = buildExcelRunRangeSummary();
            cy.log('============ SUMMARY ============');
            cy.log(
              `Excel data rows in this run: ${rowsToRun.length} (each row is one projectId in the sheet slice or filter)`,
            );
            cy.log(`Rows written to run log: ${stats.rowsLogged} (may be less than above if the test stopped early)`);
            cy.log(`Success (finished, no Error column text): ${stats.success}`);
            cy.log(`Failed or skipped with note (finished false, or Error column set): ${stats.failed}`);
            cy.log(`Excel row range (1-based sheet rows): ${rangeSummary}`);
            cy.log('==================================');
            return cy
              .log(
                `SUMMARY rows=${rowsToRun.length} logged=${stats.rowsLogged} success=${stats.success} failed=${stats.failed} | ${rangeSummary}`,
              )
              .then(() => cy.wrap(null, { log: false }));
          }
          const row = rowsToRun[i];
          const projectId = row[projectIdColIdx];
          const phoneNumber = row[phoneNumberColIdx];
          pendingRowLog = {
            row,
            logHeaders,
            cfg: env,
            index: i,
            projectIdColIdx,
          };

          const swappedName = swapVietnameseName(row[fullNameColIdx]);

          const surveyColIdx: SurveyColIdx = {
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

          return cy
            .log(`RUNNING PROJECT ID: ${projectId}`)
            .then(() =>
              cy
                .get('input[placeholder="Search producers"]')
                .should('not.be.disabled')
                .clear()
                .type(projectId as string),
            )
            .then(() => cy.get('input[placeholder="Search producers"]').should('have.value', projectId))
            .then(() => cy.wait(1000))
            .then(() => cy.get('.MuiCircularProgress-svg').should('not.exist'))
            .then(() => cy.get('div.MuiDataGrid-virtualScrollerContent').should('be.visible'))
            .then(() =>
              cy.clickLoginAsWhenNotEnrolled({
                names: [swappedName, row[fullNameColIdx] as string],
                phoneNumber: (phoneNumber as string).startsWith('0') ? (phoneNumber as string) : `0${phoneNumber}`,
              }),
            )
            .then((didClickLoginAs) => {
              if (!didClickLoginAs) {
                pendingRowLog = null;
                return cy
                  .log('Skip follow-up click because user is enrolled/not matched.')
                  .then(() =>
                    appendExcelRunLogAndRecord({
                      relativePath: env.excelLogRelativePath,
                      headers: logHeaders,
                      rowValues: row,
                      finished: true,
                    }),
                  )
                  .then(() => runFromIndex(i + 1));
              }
              return cy
                .get('.MuiDialogActions-root')
                .find('button')
                .contains(/^Login$/i)
                .should('be.visible')
                .click()
                .then(() => cy.wait(10000))
                .then(() => processFoundationFarmingAfterLogin())
                .then(() => pollIntendedPracticesStageAfterLogin())
                .then((stageState) => {
                  if (stageState === 'disabled') {
                    pendingRowLog = null;
                    return cy
                      .log(`Skip projectId ${projectId} — Intended practices disabled on program stage`)
                      .then(() =>
                        appendExcelRunLogAndRecord({
                          relativePath: env.excelLogRelativePath,
                          headers: logHeaders,
                          rowValues: row,
                          finished: true,
                          errorMessage: 'Skipped: Intended practices disabled (program stage)',
                        }),
                      )
                      .then(() => clickMenubarProfileAndStopUsingImpersonatedUser())
                      .then(() => runFromIndex(i + 1));
                  }
                  return clickIntendedPracticesUntilHeadingVisible()
                    .then(() => pollIntendedPracticesLockedAlert())
                    .then((locked) => {
                      if (locked) {
                        cy.log('Intended practices locked alert present: skip table fill');
                        return cy.wrap(null, { log: false });
                      }
                      return fillIntendedPracticesTableRows();
                    })
                    .then(() => cy.wait(3000))
                    .then(() => cy.contains('button', /^Next|Tiếp theo$/).click())
                    .then(() => cy.wait(6000))
                    .then(() =>
                      runSurveyFlowIfIncomplete(
                        () =>
                          getIframe().then(($body) => {
                            const $next = $body
                              .find('.Pagination__btn.Pagination__btn--next')
                              .filter((_, el) => Cypress.dom.isVisible(el));
                            if (!$next.length) {
                              cy.log('Pagination Next not visible — skip click, run survey steps');
                              return runIncompleteSurveyWithGuards(row, surveyColIdx);
                            }
                            return cy
                              .wrap($next.first())
                              .trigger('click')
                              .then(() => cy.wait(2000))
                              .then(() => runIncompleteSurveyWithGuards(row, surveyColIdx));
                          }),
                        () =>
                          cy
                            .contains('button', /^Finish|Hoàn thành$/i)
                            .should('be.visible')
                            .click()
                            .then(() =>
                              cy
                                .get('button[data-testid="finish-phase-button"]')
                                .contains(/Complete enrollment|Hoàn tất đăng ký/i)
                                .should('be.visible')
                                .click(),
                            )
                            .then(() => cy.wait(4000))
                            .then(() => clickMenubarProfileAndStopUsingImpersonatedUser()),
                      ),
                    )
                    .then(() =>
                      appendExcelRunLogAndRecord({
                        relativePath: env.excelLogRelativePath,
                        headers: logHeaders,
                        rowValues: row,
                        finished: true,
                      }),
                    )
                    .then(() => {
                      pendingRowLog = null;
                      return runFromIndex(i + 1);
                    });
                });
            });
        }

        Cypress.off('fail', onRowFail);
        Cypress.on('fail', onRowFail);
        return runFromIndex(0);
      });
    });
  });
});
