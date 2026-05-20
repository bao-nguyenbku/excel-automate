import {
  INTENDED_PRACTICES_HEADING_SEL,
  INTENDED_PRACTICES_LOCKED_ALERT_PATTERN,
  INTENDED_PRACTICES_NAV_ATTEMPTS,
  INTENDED_PRACTICES_STAGE_LABELS,
} from '../constants/intended-practices';

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
  cy.get('body', { timeout: 10000 }).then(($body) => {
    const $title = findIntendedPracticesStageTitleInBody($body);
    expect(
      $title.length,
      `Intended practices stage title (${INTENDED_PRACTICES_STAGE_LABELS.join(' or ')})`,
    ).to.be.greaterThan(0);
    return cy.wrap($title).click();
  });

const hasIntendedPracticesLockedAlertInBody = ($body: JQuery<HTMLBodyElement>) =>
  $body
    .find('[role="alert"].MuiAlert-outlinedInfo')
    .toArray()
    .some((el) => INTENDED_PRACTICES_LOCKED_ALERT_PATTERN.test(Cypress.$(el).text()));

const pollIntendedPracticesLockedAlert = (attempt = 0): Cypress.Chainable<boolean> => {
  return cy.get('body').then(($body) => {
    if (hasIntendedPracticesLockedAlertInBody($body)) {
      return cy.wrap(true);
    }
    if (attempt >= 5) {
      return cy.wrap(false);
    }
    return cy.wait(500).then(() => pollIntendedPracticesLockedAlert(attempt + 1));
  });
};

/** Intended practices row on stage list is not available (Start disabled / subitem disabled). */
const isIntendedPracticesStageDisabled = ($body: JQuery<HTMLBodyElement>) => {
  const $title = findIntendedPracticesStageTitleInBody($body);
  if (!$title.length) return false;
  const $sub = $title.closest('.program-stage-subitem');
  if ($sub.length && $sub.hasClass('disabled')) return true;
  const $btn = findIntendedPracticesStartButtonInBody($body);
  return $btn.length > 0 && $btn.is(':disabled');
};

const isIntendedPracticesStagePresentAndClickable = ($body: JQuery<HTMLBodyElement>) => {
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
  return cy.get('body').then(($body) => {
    if (isIntendedPracticesStageDisabled($body)) {
      return cy.wrap('disabled');
    }
    if (isIntendedPracticesStagePresentAndClickable($body)) {
      return cy.wrap('ready');
    }
    if (attempt >= 10) {
      return cy.wrap('ready');
    }
    return cy.wait(500).then(() => pollIntendedPracticesStageAfterLogin(attempt + 1));
  });
};

/**
 * Clicks the Intended practices nav item until the page shows the section heading,
 * retrying the click if the heading is not visible yet.
 * @param {number} [attempt=1]
 */
const clickIntendedPracticesUntilHeadingVisible = (attempt: number = 1): Cypress.Chainable<JQuery<HTMLElement>> =>
  clickIntendedPracticesStageTitle().then(() =>
    cy.wait(500).then(() =>
      cy.get('body').then(($body) => {
        const $heading = $body.find(INTENDED_PRACTICES_HEADING_SEL);
        const hasVisible = $heading.filter((_, el) => Cypress.dom.isVisible(el)).length > 0;
        if (hasVisible) {
          cy.log(
            `Intended practices heading visible (navigation attempt ${attempt}/${INTENDED_PRACTICES_NAV_ATTEMPTS})`,
          );
          return cy.get(INTENDED_PRACTICES_HEADING_SEL).filter(':visible').first().should('be.visible');
        }
        if (attempt >= INTENDED_PRACTICES_NAV_ATTEMPTS) {
          return cy.get(INTENDED_PRACTICES_HEADING_SEL, { timeout: 15000 }).should('be.visible');
        }
        cy.log(`Intended practices heading not ready — tab click retry ${attempt}/${INTENDED_PRACTICES_NAV_ATTEMPTS}`);
        return cy.wait(1000).then(() => clickIntendedPracticesUntilHeadingVisible(attempt + 1));
      }),
    ),
  );

/** Intended practices table: open each row’s dropdown and select fixed options when not already selected. */
const fillIntendedPracticesTableRows = () => {
  return cy.get('table tbody tr').each(($tr) => {
    cy.wrap($tr)
      .find('td:nth-child(5) div.sc-hmdomO.jpbdCg.MuiBox-root')
      .should('exist')
      .within(() => {
        cy.get('button[aria-label="toggle dropdown"]').click();
      });

    cy.get('li[data-value="Residue removal"]').then(($li) => {
      if ($li.attr('aria-selected') === 'false') {
        cy.wrap($li).click();
      } else {
        cy.log('Skip "Residue removal" because aria-selected is not true');
      }
    });
    cy.get('li[data-value="Rate reduction"]').then(($li) => {
      if ($li.attr('aria-selected') === 'false') {
        cy.wrap($li).click();
      } else {
        cy.log('Skip "Rate reduction" because aria-selected is not true');
      }
    });
    cy.get('li[data-value="Reduced planting density"]').then(($li) => {
      if ($li.attr('aria-selected') === 'false') {
        cy.wrap($li).click();
      } else {
        cy.log('Skip "Reduced planting density" because aria-selected is not true');
      }
    });
    cy.get('li[data-value="Irrigation Management"]').then(($li) => {
      if ($li.attr('aria-selected') === 'false') {
        cy.wrap($li).click();
      } else {
        cy.log('Skip "Irrigation Management" because aria-selected is not true');
      }
    });
    cy.get('body').click(0, 0);
  });
};

export {
  clickIntendedPracticesUntilHeadingVisible,
  fillIntendedPracticesTableRows,
  pollIntendedPracticesLockedAlert,
  pollIntendedPracticesStageAfterLogin,
};
