/** Stops impersonating the producer via the menubar profile menu. */
export const clickMenubarProfileAndStopUsingImpersonatedUser = () =>
  cy
    .get('.sc-dhKdcB.lfeRRa[aria-label="menubar profile"]')
    .should('be.visible')
    .click()
    .then(() => cy.wait(200))
    .then(() => cy.get('ul.sc-eeDRCY.jsJhko.MuiMenu-list').find('li:nth-child(2)').click())
    .then(() => cy.url({ timeout: 30000 }).should('include', 'admin/programs'))
    .then(() => cy.contains('Producers').should('be.visible'))
    .then(() => {
      cy.wait(5000);
      cy.get('h3.MuiTypography-root.MuiTypography-h3').contains('Producers').should('be.visible');
    });
