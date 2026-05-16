// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

Cypress.Commands.add(
  "clickLoginAsWhenNotEnrolled",
  (names: string[], options: { timeout?: number } = {}) => {
    if (Array.isArray(names) && names.length === 0) {
      cy.log("clickLoginAsWhenNotEnrolled: empty names, skip");
      return cy.wrap(false, { log: false });
    }

    const timeout = options.timeout ?? 10000;

    const normalizeName = (name: string) => {
      return name.trim().toLowerCase().split(/\s+/).sort().join(" ");
    };
    return cy
      .get(".MuiDataGrid-pinnedColumns--left .MuiDataGrid-row", { timeout })
      .then(($rows) => {
        const matchedRow = Array.from($rows).find((rowEl) => {
          return names.some(
            (name) =>
              normalizeName(name) ===
              normalizeName(
                rowEl
                  .querySelector(".MuiTypography-root.MuiTypography-h5")!
                  .textContent!.trim(),
              ),
          );
        });

        if (!matchedRow) {
          cy.log(`No row found for "${names.join(", ")}" - skip`);
          return cy.wrap(false, { log: false });
        }

        const rowId = matchedRow.getAttribute("data-id");
        if (!rowId) {
          cy.log(`Row id missing for "${names.join(", ")}" - skip`);
          return cy.wrap(false, { log: false });
        }

        return cy
          .get(
            `.MuiDataGrid-virtualScrollerRenderZone .MuiDataGrid-row[data-id="${rowId}"] [data-field="status_label"]`,
            { timeout },
          )
          .then(($statusCells) => {
            if (!$statusCells.length) {
              cy.log(`No status cell for "${names.join(", ")}" - skip`);
              return cy.wrap(false, { log: false });
            }

            const statusText = String($statusCells.first().text()).trim();
            if (/^enrolled$/i.test(statusText)) {
              cy.log(`"${names.join(", ")}" is Enrolled - skip Login as`);
              return cy.wrap(false, { log: false });
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
                  cy.log(`No Login as button for "${names.join(", ")}" - skip`);
                  return cy.wrap(false, { log: false });
                }

                return cy
                  .wrap(matchedButtons.first())
                  .click()
                  .then(() => cy.wrap(true, { log: false }));
              });
          });
      });
  },
);
