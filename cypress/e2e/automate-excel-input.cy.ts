import type {
  ExcelRow,
  ExcelWorkbook,
  LoginCredentials,
  SurveyColIdx,
  SurveyFieldKind,
  SurveyFieldSpec,
  WorkflowEnv,
} from "../types";

const parseEnvInt = (value: unknown, defaultVal: number): number => {
  if (value === undefined || value === null || value === "") {
    return defaultVal;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Expected numeric env, got: ${JSON.stringify(value)}`);
  }
  return n;
};

const resolveSliceEnd = (
  value: unknown,
  defaultExclusiveEnd: number,
): number | undefined => {
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
          iframeEl.contentWindow?.location?.href || iframeEl.contentDocument?.URL;
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
          iframeEl.contentWindow?.location?.href || iframeEl.contentDocument?.URL;
        return (
          !!doc &&
          !!doc.body &&
          doc.body.childElementCount > 0 &&
          href &&
          href !== "about:blank"
        );
      });
      if (!readyIframe?.contentDocument) {
        throw new Error("iframe document not available");
      }
      return readyIframe.contentDocument;
    });
};

const getIframe = () => {
  return getIframeDocument()
    .its("body")
    .should("not.be.undefined")
    .should("not.be.empty")
    .then((body) => cy.wrap(Cypress.$(body)));
};

/** Sync query on iframe body — avoids Cypress .find() retry when live fields are absent. */
const liveFieldContainersInBody = ($body: JQuery<HTMLElement>) =>
  $body.find('div[data-testid="livefield"] .LiveField__container');

/** Top-level question roots inside a section (e.g. Paperform). */
const liveFieldsInBody = ($body: JQuery<HTMLElement>) =>
  $body.find('div[data-testid="livefield"]');

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

const SURVEY_FIELD_REGISTRY: Record<string, SurveyFieldSpec> = {
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

const DROPDOWN_OPEN_ATTEMPTS = 5;
const DROPDOWN_OPEN_RETRY_MS = 200;

const selectDropdownInContainer = ($container, value, fieldCode) => {
  const $c = Cypress.$($container);
  if (!$c.find("div.LiveField__answer .Select-control").length) {
    cy.log(`Dropdown field "${fieldCode}" — no Select-control — skip`);
    return undefined;
  }

  const valuePattern = new RegExp(String(value), "i");
  const findVisibleMatchingOptionEl = ($body) => {
    const $match = $body
      .find("div.Select-menu-outer div.Select-option")
      .filter((_, el) => valuePattern.test(Cypress.$(el).text()))
      .filter(":visible")
      .first();
    return $match.length ? $match.get(0) : null;
  };

  const realPointerOpts = { scrollBehavior: "center" as const };

  const tryOpenAndSelect = (attempt) =>
    cy
      .wrap($container)
      .find("div.LiveField__answer .Select-control")
      .should("be.visible")
      .realClick(realPointerOpts)
      .then(() =>
        getIframe().then(($body) => {
          const el = findVisibleMatchingOptionEl($body);
          if (el) {
            return cy.wrap(el).realClick(realPointerOpts);
          }
          if (attempt >= DROPDOWN_OPEN_ATTEMPTS) {
            return getIframe()
              .find("div.Select-menu-outer div.Select-option")
              .contains(valuePattern)
              .should("be.visible")
              .realClick(realPointerOpts);
          }
          cy.log(
            `Dropdown "${fieldCode}" — menu not open, retry click (${attempt}/${DROPDOWN_OPEN_ATTEMPTS})`,
          );
          return cy
            .wait(DROPDOWN_OPEN_RETRY_MS)
            .then(() => tryOpenAndSelect(attempt + 1));
        }),
      );

  return tryOpenAndSelect(1);
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
    .find("div.PaperDateInput_container input.LiveField__input.PaperDateInput__input")
    .then(($inputs) => {
      let chain = cy.wrap(null, { log: false }) as unknown as Cypress.Chainable<
        JQuery<HTMLElement>
      >;
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
        ) as unknown as Cypress.Chainable<JQuery<HTMLElement>>;
      });
      return chain;
    });
};

const runSurveyFieldByKind = (
  kind: SurveyFieldKind,
  containerEl: HTMLElement,
  value: unknown,
  fieldCode: string,
) => {
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

const runMappedSurveyFieldSteps = (step, row, colIdx, maxPasses = 15) => {
  const processed = new Set();

  const runPass = (pass) => {
    return getIframe().then(($body) => {
      const $livefields = liveFieldsInBody($body);
      if (!$livefields.length) {
        if (pass === 0) {
          cy.log('No div[data-testid="livefield"] in iframe — skip survey fields');
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
            const run = runSurveyFieldByKind(spec.kind, containerEl, value, code);
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
      (el) => el.textContent.includes("Survey complete!") && Cypress.dom.isVisible(el),
    );

const isFinishButtonVisible = () => {
  return cy.contains("button", /^finish|hoàn thành$/i).then(($button) => {
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

const findLiveFieldContainerByCode = (
  $body: JQuery<HTMLElement>,
  fieldCode: string,
): HTMLElement | undefined => {
  const $containers = liveFieldContainersInBody($body);
  return (Array.from($containers) as HTMLElement[]).find((containerEl) => {
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

    const matchedContainer = (Array.from($containers) as HTMLElement[]).find(
      (containerEl) => {
        const headerText = Cypress.$(containerEl)
          .find("label.LiveField__header")
          .text()
          .trim();
        return headerText.startsWith(fieldCode);
      },
    );

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
    const matchedContainer = (Array.from($containers) as HTMLElement[]).find(
      (containerEl) => {
        const headerText = Cypress.$(containerEl)
          .find("label.LiveField__header")
          .text()
          .trim();
        return headerText.startsWith(fieldCode);
      },
    );

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
    .then(() => step("Draw signature", () => drawSignatureField("Please review")))
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

/** Max tab clicks while waiting for the Intended practices section heading (styled MUI h2). */
const INTENDED_PRACTICES_NAV_ATTEMPTS = 5;
const INTENDED_PRACTICES_HEADING_SEL =
  ".sc-eldPxv.cKoRHP.MuiTypography-root.MuiTypography-h2";

const INTENDED_PRACTICES_STAGE_LABELS = [
  "Intended practices",
  "Phương thức can thiệp canh tác dự kiến",
];

const findIntendedPracticesStageTitleInBody = ($body: JQuery<HTMLBodyElement>) => {
  for (const label of INTENDED_PRACTICES_STAGE_LABELS) {
    const $el = $body.find(`[data-testid="program-stage-subItem-title--${label}"]`);
    if ($el.length) return $el.first();
  }
  return Cypress.$();
};

const findIntendedPracticesStartButtonInBody = ($body: JQuery<HTMLBodyElement>) => {
  for (const label of INTENDED_PRACTICES_STAGE_LABELS) {
    const $btn = $body.find(`button[aria-label="${label}"]`);
    if ($btn.length) return $btn.first();
  }
  return Cypress.$();
};

/** Clicks whichever Intended practices stage title is present (EN or VI, not both). */
const clickIntendedPracticesStageTitle = () =>
  cy.get("body", { timeout: 10000 }).then(($body) => {
    const $title = findIntendedPracticesStageTitleInBody($body);
    expect(
      $title.length,
      `Intended practices stage title (${INTENDED_PRACTICES_STAGE_LABELS.join(" or ")})`,
    ).to.be.greaterThan(0);
    return cy.wrap($title).click();
  });

const hasIntendedPracticesLockedAlertInBody = ($body: JQuery<HTMLBodyElement>) =>
  $body
    .find('[role="alert"].MuiAlert-outlinedInfo')
    .toArray()
    .some((el) =>
      /This section is locked already enrolled in Vietnam TRVC Rice|Phần này bị khóa vì bạn đã đăng ký vào Vietnam TRVC Rice Season 5\./i.test(
        Cypress.$(el).text(),
      ),
    );

/** Poll body for locked alert (same window as old 15s `contains` wait). */
const pollIntendedPracticesLockedAlert = (attempt = 0) =>
  cy.get("body").then(($body) => {
    if (hasIntendedPracticesLockedAlertInBody($body)) {
      return cy.wrap(true);
    }
    if (attempt >= 10) {
      return cy.wrap(false);
    }
    return cy.wait(500).then(() => pollIntendedPracticesLockedAlert(attempt + 1));
  });

/** Intended practices row on stage list is not available (Start disabled / subitem disabled). */
const isIntendedPracticesStageDisabled = ($body: JQuery<HTMLBodyElement>) => {
  const $title = findIntendedPracticesStageTitleInBody($body);
  if (!$title.length) return false;
  const $sub = $title.closest(".program-stage-subitem");
  if ($sub.length && $sub.hasClass("disabled")) return true;
  const $btn = findIntendedPracticesStartButtonInBody($body);
  return $btn.length > 0 && $btn.is(":disabled");
};

const isIntendedPracticesStagePresentAndClickable = (
  $body: JQuery<HTMLBodyElement>,
) => {
  const $title = findIntendedPracticesStageTitleInBody($body);
  if (!$title.length) return false;
  return !isIntendedPracticesStageDisabled($body);
};

// const waitForStageListNetworkIdle = () =>
//   cy
//     .get("body")
//     .should(($body) => {
//       const busy = $body
//         .find('[aria-busy="true"]')
//         .filter((_, el) => Cypress.dom.isVisible(el));
//       expect(busy.length, "no visible aria-busy").to.eq(0);
//     })
//     .then(() => cy.wait(5000));

/** After impersonation, wait for stage list: disabled → skip row; else ready to open Intended practices. */
const pollIntendedPracticesStageAfterLogin = (attempt = 0) => {
  return cy.get("body").then(($body) => {
    if (isIntendedPracticesStageDisabled($body)) {
      return cy.wrap("disabled");
    }
    if (isIntendedPracticesStagePresentAndClickable($body)) {
      return cy.wrap("ready");
    }
    if (attempt >= 10) {
      return cy.wrap("ready");
    }
    return cy.wait(500).then(() => pollIntendedPracticesStageAfterLogin(attempt + 1));
  });
};

/**
 * Clicks the Intended practices nav item until the page shows the section heading,
 * retrying the click if the heading is not visible yet.
 * @param {number} [attempt=1]
 */
const clickIntendedPracticesUntilHeadingVisible = (attempt = 1) =>
  clickIntendedPracticesStageTitle().then(() =>
    cy.wait(500).then(() =>
      cy.get("body").then(($body) => {
        const $heading = $body.find(INTENDED_PRACTICES_HEADING_SEL);
        const hasVisible =
          $heading.filter((_, el) => Cypress.dom.isVisible(el)).length > 0;
        if (hasVisible) {
          cy.log(
            `Intended practices heading visible (navigation attempt ${attempt}/${INTENDED_PRACTICES_NAV_ATTEMPTS})`,
          );
          return cy
            .get(INTENDED_PRACTICES_HEADING_SEL)
            .filter(":visible")
            .first()
            .should("be.visible");
        }
        if (attempt >= INTENDED_PRACTICES_NAV_ATTEMPTS) {
          return cy
            .get(INTENDED_PRACTICES_HEADING_SEL, { timeout: 15000 })
            .should("be.visible");
        }
        cy.log(
          `Intended practices heading not ready — tab click retry ${attempt}/${INTENDED_PRACTICES_NAV_ATTEMPTS}`,
        );
        return cy
          .wait(1000)
          .then(() => clickIntendedPracticesUntilHeadingVisible(attempt + 1));
      }),
    ),
  );

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
        cy.log('Skip "Reduced planting density" because aria-selected is not true');
      }
    });
    cy.get('li[data-value="Irrigation Management"]').then(($li) => {
      if ($li.attr("aria-selected") === "false") {
        cy.wrap($li).click();
      } else {
        cy.log('Skip "Irrigation Management" because aria-selected is not true');
      }
    });
    cy.get("body").click(0, 0);
  });
};

/**
 * Opens the menubar profile control and chooses the menu action that stops acting as
 * the impersonated producer (second list item — e.g. “Stop using” / log out as user).
 * Asserts admin program URL and Producers list heading are visible afterward.
 * @returns {Cypress.Chainable}
 */
const clickMenubarProfileAndStopUsingImpersonatedUser = () =>
  cy
    .get('.sc-dhKdcB.lfeRRa[aria-label="menubar profile"]')
    .should("be.visible")
    .click()
    .then(() => cy.wait(200))
    .then(() =>
      cy.get("ul.sc-eeDRCY.jsJhko.MuiMenu-list").find("li:nth-child(2)").click(),
    )
    .then(() => cy.url({ timeout: 30000 }).should("include", "admin/programs"))
    .then(() => cy.contains("Producers").should("be.visible"))
    .then(() => {
      cy.wait(5000);
      cy.get("h3.MuiTypography-root.MuiTypography-h3")
        .contains("Producers")
        .should("be.visible");
    });

const visitAndLoginWithCredentials = (opts: LoginCredentials) => {
  cy.visit(opts.loginUrl);
  cy.wait(3000);

  cy.get("#email").click().type(opts.loginEmail);
  cy.get("#email").should("have.value", opts.loginEmail);

  cy.get("#password").click().type(opts.loginPassword);
  cy.get("#password").should("have.value", opts.loginPassword);

  cy.get('[data-testid="login-submit-button"]').click();
  cy.wait(5000);
};

describe("Automate input from excel", () => {
  // One `it` can run many Excel rows; allow long wall-clock time (ms)
  it("Full workflow", function () {
    this.timeout(45 * 60 * 1000);
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
      const env = cfg as WorkflowEnv;
      const excelDataStartRow = parseEnvInt(env.excelDataStartRow, 3);
      const dataRowSliceStart = parseEnvInt(env.dataRowSliceStart, 2);
      const dataRowSliceEnd = resolveSliceEnd(env.dataRowSliceEnd, 30);
      const filterProjectId = String(env.filterProjectId ?? "").trim();

      // Step 1: Visit login page and login with credentials
      visitAndLoginWithCredentials(env);

      // Step 2: Click on the program link
      cy.contains("a", env.programLinkText).click();
      cy.get(".MuiCircularProgress-svg").should("not.exist");

      // Step 3: Read the Excel file
      cy.task<ExcelWorkbook>("readExcelFile", {
        relativePath: env.excelRelativePath,
      }).then((workbook) => {
        expect(workbook).to.have.keys("relativePath", "sheetNames", "sheets");
        expect(workbook.sheets).to.be.an("array");
        workbook.sheets.forEach((sheet) => {
          cy.log(`Sheet "${sheet.name}": ${sheet.rows.length} rows`);
        });

        // ------------ Preparation ------------
        const header = workbook.sheets[0].rows[1];
        const firstRow = workbook.sheets[0].rows[0];
        const cellStr = (cell: unknown) => String(cell ?? "");
        const projectIdColIdx = header.findIndex((cell) =>
          /Project ID/.test(cellStr(cell)),
        );
        const fullNameColIdx = header.findIndex((cell) =>
          /Full Name/.test(cellStr(cell)),
        );
        // Survey question index in excel file
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
          throw new Error("Project ID column not found");
        }

        const dataRows = workbook.sheets[0].rows.slice(excelDataStartRow - 1);
        let rowsToRun;
        if (filterProjectId) {
          rowsToRun = dataRows.filter(
            (r) => String(r[projectIdColIdx] ?? "").trim() === filterProjectId,
          );
          cy.log(
            `filterProjectId=${filterProjectId}: ${rowsToRun.length} matching row(s) in sheet data (from row ${excelDataStartRow})`,
          );
        } else {
          rowsToRun =
            dataRowSliceEnd === undefined
              ? dataRows.slice(dataRowSliceStart - excelDataStartRow)
              : dataRows.slice(
                  dataRowSliceStart - excelDataStartRow,
                  dataRowSliceEnd - excelDataStartRow,
                );
          cy.log(
            `Excel rows: sheet slice from ${excelDataStartRow}, run indices [${dataRowSliceStart}, ${dataRowSliceEnd === undefined ? "end" : dataRowSliceEnd}) (${rowsToRun.length} rows)`,
          );
        }

        const logColCount = Math.max(
          header.length,
          firstRow.length,
          ...rowsToRun.map((r) => r.length),
        );
        const logHeaders = buildLogHeaders(firstRow, header, logColCount);
        // ------------ End of Preparation ------------

        const stats = { success: 0, failed: 0, rowsLogged: 0 };

        function buildExcelRunRangeSummary() {
          if (!rowsToRun.length) {
            return filterProjectId
              ? `no rows matched filterProjectId=${filterProjectId}`
              : "no rows in slice";
          }
          const excelRowNums = rowsToRun.map((r) => {
            const j = dataRows.indexOf(r);
            if (j === -1) return null;
            return excelDataStartRow + j;
          });
          const valid = excelRowNums.filter((n) => n != null);
          if (!valid.length) {
            return "could not map rows to Excel line numbers";
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
          return cy.task("appendExcelRunLog", opts).then(() => {
            stats.rowsLogged += 1;
            const em =
              opts.errorMessage != null && String(opts.errorMessage).trim() !== "";
            if (opts.finished === true && !em) {
              stats.success += 1;
            } else {
              stats.failed += 1;
            }
          });
        }

        interface PendingRowLog {
          row: ExcelRow;
          logHeaders: string[];
          cfg: WorkflowEnv;
          index: number;
          projectIdColIdx: number;
        }

        /** Set while a row's Cypress commands are running so `onRowFail` can log and continue. */
        let pendingRowLog: PendingRowLog | null = null;

        function onRowFail(err) {
          const ctx = pendingRowLog;
          if (!ctx) {
            return undefined;
          }
          pendingRowLog = null;
          const errMsg = err?.message ?? String(err);
          cy.log(
            `Cypress error for projectId ${ctx.row[ctx.projectIdColIdx]}: ${errMsg}`,
          );
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
            Cypress.off("fail", onRowFail);
            const rangeSummary = buildExcelRunRangeSummary();
            cy.log("========== Run summary ==========");
            cy.log(
              `Excel data rows in this run: ${rowsToRun.length} (each row is one projectId in the sheet slice or filter)`,
            );
            cy.log(
              `Rows written to run log: ${stats.rowsLogged} (may be less than above if the test stopped early)`,
            );
            cy.log(`Success (finished, no Error column text): ${stats.success}`);
            cy.log(
              `Failed or skipped with note (finished false, or Error column set): ${stats.failed}`,
            );
            cy.log(`Excel row range (1-based sheet rows): ${rangeSummary}`);
            cy.log("==================================");
            return cy
              .log(
                `SUMMARY rows=${rowsToRun.length} logged=${stats.rowsLogged} success=${stats.success} failed=${stats.failed} | ${rangeSummary}`,
              )
              .then(() => cy.wrap(null, { log: false }));
          }
          const row = rowsToRun[i];
          const projectId = row[projectIdColIdx];
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
            .log(`Project ID: ${projectId}`)
            .then(() =>
              cy
                .get('input[placeholder="Search producers"]')
                .should("not.be.disabled")
                .clear()
                .type(projectId),
            )
            .then(() =>
              cy
                .get('input[placeholder="Search producers"]')
                .should("have.value", projectId),
            )
            .then(() => cy.wait(1000))
            .then(() => cy.get(".MuiCircularProgress-svg").should("not.exist"))
            .then(() =>
              cy.get("div.MuiDataGrid-virtualScrollerContent").should("be.visible"),
            )
            .then(() =>
              cy.clickLoginAsWhenNotEnrolled([swappedName, row[fullNameColIdx]]),
            )
            .then((didClickLoginAs) => {
              if (!didClickLoginAs) {
                pendingRowLog = null;
                return cy
                  .log("Skip follow-up click because user is enrolled/not matched.")
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
                .get("div.kxxfzO button.ifYOlh")
                .click()
                .then(() => cy.wait(10000))
                .then(() => pollIntendedPracticesStageAfterLogin())
                .then((stageState) => {
                  if (stageState === "disabled") {
                    pendingRowLog = null;
                    return cy
                      .log(
                        `Skip projectId ${projectId} — Intended practices disabled on program stage`,
                      )
                      .then(() =>
                        appendExcelRunLogAndRecord({
                          relativePath: env.excelLogRelativePath,
                          headers: logHeaders,
                          rowValues: row,
                          finished: true,
                          errorMessage:
                            "Skipped: Intended practices disabled (program stage)",
                        }),
                      )
                      .then(() => clickMenubarProfileAndStopUsingImpersonatedUser())
                      .then(() => runFromIndex(i + 1));
                  }
                  return clickIntendedPracticesUntilHeadingVisible()
                    .then(() => pollIntendedPracticesLockedAlert())
                    .then((locked) => {
                      if (locked) {
                        cy.log(
                          "Intended practices locked alert present — skip table fill",
                        );
                        return cy.wrap(null, { log: false });
                      }
                      return fillIntendedPracticesTableRows();
                    })
                    .then(() => cy.wait(3000))
                    .then(() => cy.contains("button", /^Next|Tiếp theo$/).click())
                    .then(() => cy.wait(6000))
                    .then(() =>
                      runSurveyFlowIfIncomplete(
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
                            .contains("button", /^Finish|Hoàn thành$/i)
                            .should("be.visible")
                            .click()
                            .then(() =>
                              cy
                                .get('button[data-testid="finish-phase-button"]')
                                .contains(/Complete enrollment|Hoàn tất đăng ký/i)
                                .should("be.visible")
                                .click(),
                            )
                            .then(() => cy.wait(4000))
                            .then(() =>
                              clickMenubarProfileAndStopUsingImpersonatedUser(),
                            ),
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

        Cypress.off("fail", onRowFail);
        Cypress.on("fail", onRowFail);
        return runFromIndex(0);
      });
    });
  });
});
