/** @param {unknown} value @param {number} defaultVal */
const parseEnvInt = (value, defaultVal) => {
  if (value === undefined || value === null || value === "") {
    return defaultVal;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Expected numeric env, got: ${JSON.stringify(value)}`);
  }
  return n;
};

/**
 * @param {unknown} value
 * @param {number} defaultExclusiveEnd - used when value is undefined/null
 * @returns {number|undefined} undefined means slice to end of array
 */
const resolveSliceEnd = (value, defaultExclusiveEnd) => {
  if (value === undefined || value === null) {
    return defaultExclusiveEnd;
  }
  if (value === "") {
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(
      `Expected numeric dataRowSliceEnd or '', got: ${JSON.stringify(value)}`,
    );
  }
  return n;
};

const swapVietnameseName = (fullName) => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  const lastName = parts.shift();
  return [...parts, lastName].join(" ");
};

/**
 * One label per column for the run log (sheet row 0 = question codes, row 1 = field names).
 * @param {unknown[]} row0
 * @param {unknown[]} row1
 * @param {number} colCount
 * @returns {string[]}
 */
const buildLogHeaders = (row0, row1, colCount) =>
  Array.from({ length: colCount }, (_, i) => {
    const a = row0[i];
    const b = row1[i];
    const sa = a != null && String(a).trim() !== "" ? String(a).trim() : "";
    const sb = b != null && String(b).trim() !== "" ? String(b).trim() : "";
    if (sa && sb) {
      return `${sa} | ${sb}`;
    }
    return sa || sb || `Column ${i + 1}`;
  });
const getIframeDocument = () => {
  return cy
    .get("iframe", { timeout: 30000 })
    .should(($iframes) => {
      const readyIframe = Array.from($iframes).find((iframeEl) => {
        const doc = iframeEl.contentDocument;
        const href =
          iframeEl.contentWindow?.location?.href ||
          iframeEl.contentDocument?.URL;
        return (
          !!doc &&
          !!doc.body &&
          doc.body.childElementCount > 0 &&
          href &&
          href !== "about:blank"
        );
      });
      expect(readyIframe, "an iframe loaded with non-blank content").to.exist;
    })
    .then(($iframes) => {
      const readyIframe = Array.from($iframes).find((iframeEl) => {
        const doc = iframeEl.contentDocument;
        const href =
          iframeEl.contentWindow?.location?.href ||
          iframeEl.contentDocument?.URL;
        return (
          !!doc &&
          !!doc.body &&
          doc.body.childElementCount > 0 &&
          href &&
          href !== "about:blank"
        );
      });
      return readyIframe.contentDocument;
    });
};

const getIframe = () => {
  return getIframeDocument()
    .its("body")
    .should("not.be.undefined")
    .should("not.be.empty")
    .then(cy.wrap);
};

/** Sync query on iframe body — avoids Cypress .find() retry when live fields are absent. */
const liveFieldContainersInBody = ($body) =>
  $body.find('div[data-testid="livefield"] .LiveField__container');

/** Top-level question roots inside a section (e.g. Paperform). */
const liveFieldsInBody = ($body) => $body.find('div[data-testid="livefield"]');

/**
 * Reads leading question id from label text (e.g. "A1a.", "C5. ...").
 * @param {JQuery} $lf - div[data-testid="livefield"]
 */
const parseFieldCodeFromLiveField = ($lf) => {
  const headerText = $lf.find("label.LiveField__header").first().text().trim();
  if (!headerText) {
    return null;
  }
  const m = headerText.match(/^([A-Za-z]\d+[a-z]?)(?:\.|\s|$)/);
  if (!m) {
    return null;
  }
  const raw = m[1];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

/** Maps Excel colIdx keys to interaction kind for known survey codes (DOM order resolved separately). */
const SURVEY_FIELD_REGISTRY = {
  A1a: { kind: "dropdown", colKey: "a1aColIdx" },
  A1b: { kind: "dropdown", colKey: "a1bColIdx" },
  A1c: { kind: "yesNo", colKey: "a1cColIdx" },
  A2: { kind: "text", colKey: "a2ColIdx" },
  A3: { kind: "text", colKey: "a3ColIdx" },
  A4: { kind: "text", colKey: "a4ColIdx" },
  A4a: { kind: "text", colKey: "a4aColIdx" },
  A4b: { kind: "text", colKey: "a4bColIdx" },
  A5: { kind: "text", colKey: "a5ColIdx" },
  A6: { kind: "optionalText", colKey: "a6ColIdx" },
  A7: { kind: "optionalText", colKey: "a7ColIdx" },
  A8: { kind: "optionalText", colKey: "a8ColIdx" },
  C4: { kind: "date", colKey: "c4ColIdx" },
  C5: { kind: "date", colKey: "c5ColIdx" },
};

const selectDropdownInContainer = ($container, value, fieldCode) => {
  const $c = Cypress.$($container);
  if (!$c.find("div.LiveField__answer .Select-control").length) {
    cy.log(`Dropdown field "${fieldCode}" — no Select-control — skip`);
    return undefined;
  }
  return cy
    .wrap($container)
    .find("div.LiveField__answer .Select-control")
    .should("be.visible")
    .click()
    .then(() =>
      getIframe()
        .find("div.Select-menu-outer div.Select-option")
        .contains(new RegExp(String(value), "i"))
        .should("be.visible")
        .click(),
    );
};

const clickYesNoInContainer = ($container, value, fieldCode) => {
  const $c = Cypress.$($container);
  if (!$c.find("div.LiveField__answer div.btn-raised.YesNo__button").length) {
    cy.log(`Yes/No field "${fieldCode}" — no buttons — skip`);
    return undefined;
  }
  return cy
    .wrap($container)
    .find("div.LiveField__answer")
    .find("div.btn-raised.YesNo__button")
    .contains(new RegExp(String(value), "i"))
    .should("be.visible")
    .click();
};

const typeTextInContainer = ($container, value, fieldCode, optional) => {
  const $c = Cypress.$($container);
  if (!$c.find("div.LiveField__answer input.LiveField__input").length) {
    cy.log(
      optional
        ? `${fieldCode} field not found — skip`
        : `Text field "${fieldCode}" not found — skip`,
    );
    return undefined;
  }
  return cy
    .wrap($container)
    .find("div.LiveField__answer")
    .find("input.LiveField__input")
    .click()
    .clear()
    .type(String(value));
};

const typeDateInContainer = ($container, rawValue, fieldCode) => {
  const date = new Date(rawValue);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const formattedDay = day < 9 ? `0${day}` : String(day);
  const formattedMonth = month < 9 ? `0${month}` : String(month);

  const $c = Cypress.$($container);
  if (
    !$c.find(
      "div.LiveField__answer div.PaperDateInput_container input.LiveField__input.PaperDateInput__input",
    ).length
  ) {
    cy.log(`Date field "${fieldCode}" — no date inputs — skip`);
    return undefined;
  }

  return cy
    .wrap($container)
    .find("div.LiveField__answer")
    .find(
      "div.PaperDateInput_container input.LiveField__input.PaperDateInput__input",
    )
    .then(($inputs) => {
      let chain = cy.wrap(null, { log: false });
      $inputs.each((_, input) => {
        const $input = Cypress.$(input);
        const name = $input.attr("name");
        let val;
        if (name === "day") {
          val = formattedDay;
        } else if (name === "month") {
          val = formattedMonth;
        } else if (name === "year") {
          val = String(year);
        } else {
          return;
        }
        chain = chain.then(() =>
          cy.wrap($input).clear({ force: true }).type(val, { force: true }),
        );
      });
      return chain;
    });
};

/**
 * @param {"dropdown"|"yesNo"|"text"|"optionalText"|"date"} kind
 * @param {HTMLElement} containerEl - .LiveField__container
 */
const runSurveyFieldByKind = (kind, containerEl, value, fieldCode) => {
  switch (kind) {
    case "dropdown": {
      return selectDropdownInContainer(containerEl, value, fieldCode);
    }
    case "yesNo":
      return clickYesNoInContainer(containerEl, value, fieldCode);
    case "text":
      return typeTextInContainer(containerEl, value, fieldCode, false);
    case "optionalText":
      return typeTextInContainer(containerEl, value, fieldCode, true);
    case "date":
      return typeDateInContainer(containerEl, value, fieldCode);
    default:
      return undefined;
  }
};

/**
 * Walk `div[data-testid="livefield"]` in DOM order and run registry steps.
 * Re-queries the iframe after each pass so fields revealed by earlier answers (e.g. A2 then A3)
 * are picked up. Each question code runs at most once per row (`processed` avoids re-typing).
 *
 * @param {(label: string, fn: () => Cypress.Chainable|undefined) => Cypress.Chainable} step
 * @param {number} [maxPasses=15] - safety cap if the form keeps adding fields
 */
const runMappedSurveyFieldSteps = (step, row, colIdx, maxPasses = 15) => {
  const processed = new Set();

  const runPass = (pass) => {
    return getIframe().then(($body) => {
      const $livefields = liveFieldsInBody($body);
      if (!$livefields.length) {
        if (pass === 0) {
          cy.log(
            'No div[data-testid="livefield"] in iframe — skip survey fields',
          );
        }
        return undefined;
      }

      let chain = cy.wrap(null, { log: false });
      let ranAny = false;

      $livefields.each((_, el) => {
        const $lf = Cypress.$(el);
        const code = parseFieldCodeFromLiveField($lf);
        if (!code || processed.has(code)) {
          return;
        }
        const spec = SURVEY_FIELD_REGISTRY[code];
        if (!spec) {
          return;
        }
        const colIndex = colIdx[spec.colKey];
        if (colIndex === undefined || colIndex < 0) {
          return;
        }
        const value = row[colIndex];
        const containerEl = $lf.find(".LiveField__container").get(0);
        if (!containerEl) {
          return;
        }
        ranAny = true;
        chain = chain.then(() =>
          step(code, () => {
            const run = runSurveyFieldByKind(
              spec.kind,
              containerEl,
              value,
              code,
            );
            const markDone = () => {
              processed.add(code);
            };
            if (run != null && typeof run.then === "function") {
              return run.then(markDone);
            }
            markDone();
            return run;
          }),
        );
      });

      if (!ranAny || pass + 1 >= maxPasses) {
        if (ranAny && pass + 1 >= maxPasses) {
          cy.log(
            `runMappedSurveyFieldSteps: max passes (${maxPasses}) reached — there may be unanswered fields`,
          );
        }
        return chain;
      }
      return chain.then(() => runPass(pass + 1));
    });
  };

  return runPass(0);
};

const getFieldContainer = (fieldCode) => {
  return getIframe()
    .contains(
      'div[data-testid="livefield"] .LiveField__container label.LiveField__header',
      fieldCode,
    )
    .should("be.visible")
    .closest("div.LiveField__container");
};

const isSurveyCompleteVisible = ($body) =>
  $body
    .find("div")
    .toArray()
    .some(
      (el) =>
        el.textContent.includes("Survey complete!") &&
        Cypress.dom.isVisible(el),
    );

const isFinishButtonVisible = () => {
  return cy.contains("button", /^finish$/i).then(($button) => {
    if (!$button) {
      return cy.wrap(false);
    }
    const disabled = $button.attr("disabled");
    if (disabled) {
      return cy.wrap(false);
    }
    return cy.wrap(true);
  });
};

const findLiveFieldContainerByCode = ($body, fieldCode) => {
  const $containers = liveFieldContainersInBody($body);
  return Array.from($containers).find((containerEl) => {
    const headerText = Cypress.$(containerEl)
      .find("label.LiveField__header")
      .text()
      .trim();
    return headerText.startsWith(fieldCode);
  });
};

const selectDropdownField = (fieldCode, value) => {
  return getIframe().then(($body) => {
    const matchedContainer = findLiveFieldContainerByCode($body, fieldCode);
    if (!matchedContainer) {
      cy.log(`Dropdown field "${fieldCode}" not found — skip`);
      return undefined;
    }
    return selectDropdownInContainer(matchedContainer, value, fieldCode);
  });
};

const clickYesNoField = (fieldCode, value) => {
  return getIframe().then(($body) => {
    const matchedContainer = findLiveFieldContainerByCode($body, fieldCode);
    if (!matchedContainer) {
      cy.log(`Yes/No field "${fieldCode}" not found — skip`);
      return undefined;
    }
    return clickYesNoInContainer(matchedContainer, value, fieldCode);
  });
};

const typeTextField = (fieldCode, value) => {
  return getIframe().then(($body) => {
    const matchedContainer = findLiveFieldContainerByCode($body, fieldCode);
    if (!matchedContainer) {
      cy.log(`Text field "${fieldCode}" not found — skip`);
      return undefined;
    }
    return typeTextInContainer(matchedContainer, value, fieldCode, false);
  });
};

const typeOptionalTextField = (fieldCode, value) => {
  return getIframe().then(($body) => {
    const matchedContainer = findLiveFieldContainerByCode($body, fieldCode);
    if (!matchedContainer) {
      cy.log(`${fieldCode} field not found - skip`);
      return undefined;
    }
    return typeTextInContainer(matchedContainer, value, fieldCode, true);
  });
};

const typeDateField = (fieldCode, rawValue) => {
  return getIframe().then(($body) => {
    const matchedContainer = findLiveFieldContainerByCode($body, fieldCode);
    if (!matchedContainer) {
      cy.log(`Date field "${fieldCode}" not found — skip`);
      return undefined;
    }
    return typeDateInContainer(matchedContainer, rawValue, fieldCode);
  });
};

const clickIframeNext = () => {
  return getIframe().then(($body) => {
    const $next = $body
      .find("button.Pagination__btn.Pagination__btn--next")
      .filter((_, el) => Cypress.dom.isVisible(el));

    if (!$next.length) {
      cy.log("Pagination Next not in iframe — skip click");
      return undefined;
    }

    return cy.wrap($next.first()).click();
  });
};

const drawSignatureField = (fieldCode) => {
  return getIframe().then(($body) => {
    const $containers = liveFieldContainersInBody($body);
    if (!$containers.length) {
      cy.log(`Signature field "${fieldCode}" — no .LiveField__container, skip`);
      return undefined;
    }

    const matchedContainer = Array.from($containers).find((containerEl) => {
      const headerText = Cypress.$(containerEl)
        .find("label.LiveField__header")
        .text()
        .trim();
      return headerText.startsWith(fieldCode);
    });

    if (!matchedContainer) {
      cy.log(`Signature field "${fieldCode}" not found — skip`);
      return undefined;
    }

    return cy
      .wrap(matchedContainer)
      .find("div.LiveField__answer")
      .find('div[data-testid="signature-field"] canvas.Signature')
      .should("be.visible")
      .then(($canvas) => {
        const el = $canvas[0];
        const rect = el.getBoundingClientRect();
        const startX = rect.left;
        const startY = rect.top;
        const endX = rect.left + rect.width / 2;
        const endY = rect.top + rect.height / 2;

        return cy
          .wrap($canvas)
          .trigger("mousedown", {
            which: 1,
            clientX: startX,
            clientY: startY,
          })
          .trigger("mousemove", {
            which: 1,
            clientX: endX,
            clientY: endY,
          })
          .trigger("mouseup", { which: 1 });
      });
  });
};

const confirmSignature = (fieldCode) => {
  return getIframe().then(($body) => {
    const $containers = liveFieldContainersInBody($body);
    const matchedContainer = Array.from($containers).find((containerEl) => {
      const headerText = Cypress.$(containerEl)
        .find("label.LiveField__header")
        .text()
        .trim();
      return headerText.startsWith(fieldCode);
    });

    if (!matchedContainer) {
      cy.log(`Signature confirm "${fieldCode}" not found — skip`);
      return undefined;
    }

    return cy
      .wrap(matchedContainer)
      .find("div.LiveField__answer")
      .find(".Signature__done")
      .should("be.visible")
      .click()
      .then(() => cy.wait(8000))
      .then(() =>
        getIframe()
          .find('span[data-testid="submitbutton"]')
          .should("be.visible")
          .should("contain.text", "Submit")
          .click(),
      )
      .then(() => cy.wait(5000));
  });
};

/**
 * Chained survey field steps (used inside runIncompleteSurveyWithGuards).
 * @param {(label: string, fn: () => Cypress.Chainable|undefined) => Cypress.Chainable} step
 * @param {unknown[]} row
 * @param {Record<string, number>} colIdx
 */
const runSurveyQuestionSteps = (step, row, colIdx) => {
  let isCompleted = false;
  return cy
    .wrap(null)
    .then(() => runMappedSurveyFieldSteps(step, row, colIdx))
    .then(() => step("Next before signature", () => clickIframeNext()))
    .then(() =>
      step("Draw signature", () => drawSignatureField("Please review")),
    )
    .then(() =>
      step("Confirm signature", () =>
        confirmSignature("Please review").then(() => (isCompleted = true)),
      ),
    )
    .then(() => {
      if (!isCompleted) {
        return step("Next after step", () => clickIframeNext()).then(() =>
          runSurveyQuestionSteps(step, row, colIdx),
        );
      }
      return undefined;
    });
};

/**
 * @param {unknown[]} row - Excel data row
 * @param {Record<string, number>} colIdx - column indices from sheet header row (e.g. a1aColIdx)
 */
const runIncompleteSurveyWithGuards = (row, colIdx) => {
  let aborted = false;

  const step = (label, fn) =>
    cy.wrap(null).then(() => {
      if (aborted) {
        return undefined;
      }
      isFinishButtonVisible().then((visible) => {
        if (visible) {
          aborted = true;
          cy.log(`Survey complete at "${label}" — skip remaining steps`);
          return undefined;
        }
        return fn();
      });
    });

  return runSurveyQuestionSteps(step, row, colIdx);
};

/**
 * If a visible Finish button is present, run `runCompleteFlow`.
 * Otherwise run `runIncompleteFlow`, then re-check Finish and run `runCompleteFlow` when it appears.
 * Callbacks should return Cypress chains so this helper can wait for them.
 */
const runSurveyFlowIfIncomplete = (runIncompleteFlow, runCompleteFlow) => {
  return isFinishButtonVisible().then((visible) => {
    if (visible) {
      cy.log("Finish button is visible — run complete flow");
      return runCompleteFlow();
    }
    return runIncompleteFlow().then(() =>
      runSurveyFlowIfIncomplete(runIncompleteFlow, runCompleteFlow),
    );
  });
};

/** Intended practices table: open each row’s dropdown and select fixed options when not already selected. */
const fillIntendedPracticesTableRows = () => {
  return cy.get("table tbody tr").each(($tr) => {
    cy.wrap($tr)
      .find("td:nth-child(5) div.sc-hmdomO.jpbdCg.MuiBox-root")
      .should("exist")
      .within(() => {
        cy.get('button[aria-label="toggle dropdown"]').click();
      });

    cy.get('li[data-value="Residue removal"]').then(($li) => {
      if ($li.attr("aria-selected") === "false") {
        cy.wrap($li).click();
      } else {
        cy.log('Skip "Residue removal" because aria-selected is not true');
      }
    });
    cy.get('li[data-value="Rate reduction"]').then(($li) => {
      if ($li.attr("aria-selected") === "false") {
        cy.wrap($li).click();
      } else {
        cy.log('Skip "Rate reduction" because aria-selected is not true');
      }
    });
    cy.get('li[data-value="Reduced planting density"]').then(($li) => {
      if ($li.attr("aria-selected") === "false") {
        cy.wrap($li).click();
      } else {
        cy.log(
          'Skip "Reduced planting density" because aria-selected is not true',
        );
      }
    });
    cy.get('li[data-value="Irrigation Management"]').then(($li) => {
      if ($li.attr("aria-selected") === "false") {
        cy.wrap($li).click();
      } else {
        cy.log(
          'Skip "Irrigation Management" because aria-selected is not true',
        );
      }
    });
    cy.get("body").click(0, 0);
  });
};

describe("Automate input from excel", () => {
  it("Full workflow", () => {
    cy.env([
      "loginUrl",
      "loginEmail",
      "loginPassword",
      "programLinkText",
      "excelRelativePath",
      "excelLogRelativePath",
      "excelDataStartRow",
      "dataRowSliceStart",
      "dataRowSliceEnd",
      "filterProjectId",
    ]).then((cfg) => {
      const excelDataStartRow = parseEnvInt(cfg.excelDataStartRow, 3);
      const dataRowSliceStart = parseEnvInt(cfg.dataRowSliceStart, 2);
      const dataRowSliceEnd = resolveSliceEnd(cfg.dataRowSliceEnd, 30);
      const filterProjectId = String(cfg.filterProjectId ?? "").trim();

      cy.visit(cfg.loginUrl);
      cy.wait(3000);

      cy.get("#email").click().type(cfg.loginEmail);
      cy.get("#email").should("have.value", cfg.loginEmail);

      cy.get("#password").click().type(cfg.loginPassword);
      cy.get("#password").should("have.value", cfg.loginPassword);

      cy.get('[data-testid="login-submit-button"]').click();
      cy.wait(5000);
      cy.contains("a", cfg.programLinkText).click();

      cy.get(".MuiCircularProgress-svg").should("not.exist");
      cy.task("readExcelFile", {
        relativePath: cfg.excelRelativePath,
      }).then((workbook) => {
        expect(workbook).to.have.keys("relativePath", "sheetNames", "sheets");
        expect(workbook.sheets).to.be.an("array");
        workbook.sheets.forEach((sheet) => {
          cy.log(`Sheet "${sheet.name}": ${sheet.rows.length} rows`);
        });
        cy.log(JSON.stringify(workbook, null, 2));

        // ------------ Preparation ------------
        const header = workbook.sheets[0].rows[1];
        const firstRow = workbook.sheets[0].rows[0];
        const projectIdColIdx = header.findIndex((cell) =>
          /Project ID/.test(cell),
        );
        const fullNameColIdx = header.findIndex((cell) =>
          /Full Name/.test(cell),
        );
        // Survey questions
        const a1aColIdx = firstRow.findIndex((cell) => /A1a/.test(cell));
        const a1bColIdx = firstRow.findIndex((cell) => /A1b/.test(cell));
        const a1cColIdx = firstRow.findIndex((cell) => /A1c/.test(cell));
        const a2ColIdx = firstRow.findIndex((cell) => /A2/.test(cell));
        const a3ColIdx = firstRow.findIndex((cell) => /A3/.test(cell));
        const a4ColIdx = firstRow.findIndex((cell) => /A4/.test(cell));
        const a4aColIdx = firstRow.findIndex((cell) => /A4a/.test(cell));
        const a4bColIdx = firstRow.findIndex((cell) => /A4b/.test(cell));
        const a5ColIdx = firstRow.findIndex((cell) => /A5/.test(cell));
        const a6ColIdx = firstRow.findIndex((cell) => /A6/.test(cell));
        const a7ColIdx = firstRow.findIndex((cell) => /A7/.test(cell));
        const a8ColIdx = firstRow.findIndex((cell) => /A8/.test(cell));
        const c4ColIdx = firstRow.findIndex((cell) => /C4/.test(cell));
        const c5ColIdx = firstRow.findIndex((cell) => /C5/.test(cell));

        if (projectIdColIdx === -1) {
          throw new Error("Project ID column not found");
        }

        const dataRows = workbook.sheets[0].rows.slice(excelDataStartRow - 1);
        const rowsToRun =
          dataRowSliceEnd === undefined
            ? dataRows.slice(dataRowSliceStart - excelDataStartRow)
            : dataRows.slice(
                dataRowSliceStart - excelDataStartRow,
                dataRowSliceEnd - excelDataStartRow,
              );
        cy.log(
          `Excel rows: sheet slice from ${excelDataStartRow}, run indices [${dataRowSliceStart}, ${dataRowSliceEnd === undefined ? "end" : dataRowSliceEnd}) (${rowsToRun.length} rows)`,
        );

        const logColCount = Math.max(
          header.length,
          firstRow.length,
          ...rowsToRun.map((r) => r.length),
        );
        const logHeaders = buildLogHeaders(firstRow, header, logColCount);

        // ------------ End of Preparation ------------
        cy.wrap(rowsToRun).each((row) => {
          const projectId = row[projectIdColIdx];

          if (filterProjectId && String(projectId).trim() !== filterProjectId) {
            cy.log(`Skip projectId ${projectId}`);
            return;
          }
          cy.log(`Project ID: ${projectId}`);
          cy.get('input[placeholder="Search producers"]')
            .clear()
            .type(projectId);
          cy.get('input[placeholder="Search producers"]').should(
            "have.value",
            projectId,
          );
          cy.wait(1000);
          cy.get(".MuiCircularProgress-svg").should("not.exist");
          cy.get("div.MuiDataGrid-virtualScrollerContent").should("be.visible");

          const swappedName = swapVietnameseName(row[fullNameColIdx]);

          cy.clickLoginAsWhenNotEnrolled(swappedName).then(
            (didClickLoginAs) => {
              if (!didClickLoginAs) {
                cy.log(
                  "Skip follow-up click because user is enrolled/not matched.",
                );
                cy.task("appendExcelRunLog", {
                  relativePath: cfg.excelLogRelativePath,
                  headers: logHeaders,
                  rowValues: row,
                  finished: true,
                });
                return;
              }
              cy.get("div.kxxfzO button.ifYOlh").click();
              cy.wait(6000);

              cy.get(
                '[data-testid="program-stage-subItem-title--Intended practices"]',
              ).click();
              cy.wait(3000);

              fillIntendedPracticesTableRows();
              cy.wait(3000);

              cy.contains("button", /^Next$/).click();
              cy.wait(4000);

              const surveyColIdx = {
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

              cy.wait(5000);
              return runSurveyFlowIfIncomplete(
                () =>
                  getIframe().then(($body) => {
                    const $next = $body
                      .find(".Pagination__btn.Pagination__btn--next")
                      .filter((_, el) => Cypress.dom.isVisible(el));
                    if (!$next.length) {
                      cy.log(
                        "Pagination Next not visible — skip click, run survey steps",
                      );
                      return runIncompleteSurveyWithGuards(row, surveyColIdx);
                    }
                    return cy
                      .wrap($next.first())
                      .trigger("click")
                      .then(() => cy.wait(2000))
                      .then(() =>
                        runIncompleteSurveyWithGuards(row, surveyColIdx),
                      );
                  }),
                () =>
                  cy
                    .contains("button", /^Finish$/i)
                    .should("be.visible")
                    .click()
                    .then(() =>
                      cy
                        .get('button[data-testid="finish-phase-button"]')
                        .contains("Complete enrollment")
                        .should("be.visible")
                        .click(),
                    )
                    .then(() => cy.wait(4000))
                    .then(() =>
                      cy
                        .get('.sc-dhKdcB.lfeRRa[aria-label="menubar profile"]')
                        .should("be.visible")
                        .click(),
                    )
                    .then(() => cy.wait(200))
                    .then(() =>
                      cy
                        .get("ul.sc-eeDRCY.jsJhko.MuiMenu-list")
                        .find("li:nth-child(2)")
                        .click(),
                    )
                    .then(() => cy.wait(2000)),
              ).then(() =>
                cy.task("appendExcelRunLog", {
                  relativePath: cfg.excelLogRelativePath,
                  headers: logHeaders,
                  rowValues: row,
                  finished: true,
                }),
              );
            },
          );
        });
      });
    });
  });
});
