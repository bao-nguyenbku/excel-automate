import type { SurveyColIdx, SurveyFieldKind } from '../../types';
import { DROPDOWN_OPEN_ATTEMPTS, DROPDOWN_OPEN_RETRY_MS, SURVEY_FIELD_REGISTRY } from '../constants/survey-fields';
import { getIframe, liveFieldContainersInBody, liveFieldsInBody, parseFieldCodeFromLiveField } from './iframe';

const selectDropdownInContainer = ($container, value, fieldCode) => {
  const $c = Cypress.$($container);
  if (!$c.find('div.LiveField__answer .Select-control').length) {
    cy.log(`Dropdown field "${fieldCode}" — no Select-control — skip`);
    return undefined;
  }

  const valuePattern = new RegExp(String(value), 'i');
  const findVisibleMatchingOptionEl = ($body) => {
    const $match = $body
      .find('div.Select-menu-outer div.Select-option')
      .filter((_, el) => valuePattern.test(Cypress.$(el).text()))
      .filter(':visible')
      .first();
    return $match.length ? $match.get(0) : null;
  };

  const realPointerOpts = { scrollBehavior: 'center' as const };

  const tryOpenAndSelect = (attempt) =>
    cy
      .wrap($container)
      .find('div.LiveField__answer .Select-control')
      .should('be.visible')
      .realClick(realPointerOpts)
      .then(() =>
        getIframe().then(($body) => {
          const el = findVisibleMatchingOptionEl($body);
          if (el) {
            return cy.wrap(el).realClick(realPointerOpts);
          }
          if (attempt >= DROPDOWN_OPEN_ATTEMPTS) {
            return getIframe()
              .find('div.Select-menu-outer div.Select-option')
              .contains(valuePattern)
              .should('be.visible')
              .realClick(realPointerOpts);
          }
          cy.log(`Dropdown "${fieldCode}" — menu not open, retry click (${attempt}/${DROPDOWN_OPEN_ATTEMPTS})`);
          return cy.wait(DROPDOWN_OPEN_RETRY_MS).then(() => tryOpenAndSelect(attempt + 1));
        }),
      );

  return tryOpenAndSelect(1);
};

const clickYesNoInContainer = ($container, value, fieldCode) => {
  const $c = Cypress.$($container);
  if (!$c.find('div.LiveField__answer div.btn-raised.YesNo__button').length) {
    cy.log(`Yes/No field "${fieldCode}" — no buttons — skip`);
    return undefined;
  }
  return cy
    .wrap($container)
    .find('div.LiveField__answer')
    .find('div.btn-raised.YesNo__button')
    .contains(new RegExp(String(value), 'i'))
    .should('be.visible')
    .click();
};

const typeTextInContainer = ($container, value, fieldCode, optional) => {
  const $c = Cypress.$($container);
  if (!$c.find('div.LiveField__answer input.LiveField__input').length) {
    cy.log(optional ? `${fieldCode} field not found — skip` : `Text field "${fieldCode}" not found — skip`);
    return undefined;
  }
  return cy
    .wrap($container)
    .find('div.LiveField__answer')
    .find('input.LiveField__input')
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
    !$c.find('div.LiveField__answer div.PaperDateInput_container input.LiveField__input.PaperDateInput__input').length
  ) {
    cy.log(`Date field "${fieldCode}" — no date inputs — skip`);
    return undefined;
  }

  return cy
    .wrap($container)
    .find('div.LiveField__answer')
    .find('div.PaperDateInput_container input.LiveField__input.PaperDateInput__input')
    .then(($inputs) => {
      let chain = cy.wrap(null, { log: false }) as unknown as Cypress.Chainable<JQuery<HTMLElement>>;
      $inputs.each((_, input) => {
        const $input = Cypress.$(input);
        const name = $input.attr('name');
        let val;
        if (name === 'day') {
          val = formattedDay;
        } else if (name === 'month') {
          val = formattedMonth;
        } else if (name === 'year') {
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

const runSurveyFieldByKind = (kind: SurveyFieldKind, containerEl: HTMLElement, value: unknown, fieldCode: string) => {
  switch (kind) {
    case 'dropdown': {
      return selectDropdownInContainer(containerEl, value, fieldCode);
    }
    case 'yesNo':
      return clickYesNoInContainer(containerEl, value, fieldCode);
    case 'text':
      return typeTextInContainer(containerEl, value, fieldCode, false);
    case 'optionalText':
      return typeTextInContainer(containerEl, value, fieldCode, true);
    case 'date':
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
        const containerEl = $lf.find('.LiveField__container').get(0);
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
            if (run != null && typeof run.then === 'function') {
              return run.then(markDone);
            }
            markDone();
            return run;
          }),
        );
      });

      if (!ranAny || pass + 1 >= maxPasses) {
        if (ranAny && pass + 1 >= maxPasses) {
          cy.log(`runMappedSurveyFieldSteps: max passes (${maxPasses}) reached — there may be unanswered fields`);
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
    .contains('div[data-testid="livefield"] .LiveField__container label.LiveField__header', fieldCode)
    .should('be.visible')
    .closest('div.LiveField__container');
};

const isSurveyCompleteVisible = ($body) =>
  $body
    .find('div')
    .toArray()
    .some((el) => el.textContent.includes('Survey complete!') && Cypress.dom.isVisible(el));

const isFinishButtonVisible = () => {
  return cy.contains('button', /^finish|hoàn thành$/i).then(($button) => {
    if (!$button) {
      return cy.wrap(false);
    }
    const disabled = $button.attr('disabled');
    if (disabled) {
      return cy.wrap(false);
    }
    return cy.wrap(true);
  });
};

const findLiveFieldContainerByCode = ($body: JQuery<HTMLElement>, fieldCode: string): HTMLElement | undefined => {
  const $containers = liveFieldContainersInBody($body);
  return (Array.from($containers) as HTMLElement[]).find((containerEl) => {
    const headerText = Cypress.$(containerEl).find('label.LiveField__header').text().trim();
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
      .find('button.Pagination__btn.Pagination__btn--next')
      .filter((_, el) => Cypress.dom.isVisible(el));

    if (!$next.length) {
      cy.log('Pagination Next not in iframe — skip click');
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

    const matchedContainer = (Array.from($containers) as HTMLElement[]).find((containerEl) => {
      const headerText = Cypress.$(containerEl).find('label.LiveField__header').text().trim();
      return headerText.startsWith(fieldCode);
    });

    if (!matchedContainer) {
      cy.log(`Signature field "${fieldCode}" not found — skip`);
      return undefined;
    }

    return cy
      .wrap(matchedContainer)
      .find('div.LiveField__answer')
      .find('div[data-testid="signature-field"] canvas.Signature')
      .should('be.visible')
      .then(($canvas) => {
        const el = $canvas[0];
        const rect = el.getBoundingClientRect();
        const startX = rect.left;
        const startY = rect.top;
        const endX = rect.left + rect.width / 2;
        const endY = rect.top + rect.height / 2;

        return cy
          .wrap($canvas)
          .trigger('mousedown', {
            which: 1,
            clientX: startX,
            clientY: startY,
          })
          .trigger('mousemove', {
            which: 1,
            clientX: endX,
            clientY: endY,
          })
          .trigger('mouseup', { which: 1 });
      });
  });
};

const confirmSignature = (fieldCode) => {
  return getIframe().then(($body) => {
    const $containers = liveFieldContainersInBody($body);
    const matchedContainer = (Array.from($containers) as HTMLElement[]).find((containerEl) => {
      const headerText = Cypress.$(containerEl).find('label.LiveField__header').text().trim();
      return headerText.startsWith(fieldCode);
    });

    if (!matchedContainer) {
      cy.log(`Signature confirm "${fieldCode}" not found — skip`);
      return undefined;
    }

    return cy
      .wrap(matchedContainer)
      .find('div.LiveField__answer')
      .find('.Signature__done')
      .should('be.visible')
      .click()
      .then(() => cy.wait(8000))
      .then(() =>
        getIframe()
          .find('span[data-testid="submitbutton"]')
          .should('be.visible')
          .should('contain.text', 'Submit')
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
    .then(() => step('Next before signature', () => clickIframeNext()))
    .then(() => step('Draw signature', () => drawSignatureField('Please review')))
    .then(() => step('Confirm signature', () => confirmSignature('Please review').then(() => (isCompleted = true))))
    .then(() => {
      if (!isCompleted) {
        return step('Next after step', () => clickIframeNext()).then(() => runSurveyQuestionSteps(step, row, colIdx));
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
      cy.log('Finish button is visible — run complete flow');
      return runCompleteFlow();
    }
    return runIncompleteFlow().then(() => runSurveyFlowIfIncomplete(runIncompleteFlow, runCompleteFlow));
  });
};

export { getIframe } from './iframe';
export { runIncompleteSurveyWithGuards, runSurveyFlowIfIncomplete };
