// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

/**
 * Clicks "Login as..." on a MUI DataGrid row with pinned name + scrollable columns.
 * Resolves the logical row via `data-id`: name in `.MuiDataGrid-pinnedColumns--left`
 * (`data-field="user_name"`), status in `.MuiDataGrid-virtualScrollerRenderZone`
 * (`data-field="status_label"`). Fails if status is Enrolled.
 *
 * @param {string} displayName - Visible name in the pinned Name cell (case-insensitive).
 * @param {object} [options] - Options passed to cy.contains for the name match (e.g. timeout).
 * @returns {Cypress.Chainable<boolean>} true when Login as was clicked; false when skipped.
 */
Cypress.Commands.add(
  "clickLoginAsWhenNotEnrolled",
  (displayName, options = {}) => {
    const name = String(displayName ?? "").trim();
    if (!name) {
      cy.log("clickLoginAsWhenNotEnrolled: empty displayName, skip");
      return cy.wrap(false, { log: false });
    }

    const timeout = options.timeout ?? 10000;
    const normalizedName = name.toLowerCase();

    return cy
      .get(".MuiDataGrid-pinnedColumns--left .MuiDataGrid-row", { timeout })
      .then(($rows) => {
        const matchedRow = Array.from($rows).find((rowEl) =>
          String(rowEl.textContent).toLowerCase().includes(normalizedName),
        );

        if (!matchedRow) {
          cy.log(`No row found for "${name}" - skip`);
          return false;
        }

        const rowId = matchedRow.getAttribute("data-id");
        if (!rowId) {
          cy.log(`Row id missing for "${name}" - skip`);
          return false;
        }

        return cy
          .get(
            `.MuiDataGrid-virtualScrollerRenderZone .MuiDataGrid-row[data-id="${rowId}"] [data-field="status_label"]`,
            { timeout },
          )
          .then(($statusCells) => {
            if (!$statusCells.length) {
              cy.log(`No status cell for "${name}" - skip`);
              return false;
            }

            const statusText = String($statusCells.first().text()).trim();
            if (/^enrolled$/i.test(statusText)) {
              cy.log(`"${name}" is Enrolled - skip Login as`);
              return false;
            }

            return cy
              .get(
                `.MuiDataGrid-virtualScrollerContent .MuiDataGrid-row[data-id="${rowId}"] button`,
                { timeout },
              )
              .then(($buttons) => {
                const matchedButtons = $buttons.filter((_, btnEl) =>
                  /^login as(\.\.\.)?$/i.test(String(btnEl.textContent).trim()),
                );

                if (!matchedButtons.length) {
                  cy.log(`No Login as button for "${name}" - skip`);
                  return false;
                }

                return cy
                  .wrap(matchedButtons.first())
                  .click()
                  .then(() => true);
              });
          });
      });
  },
);

//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
