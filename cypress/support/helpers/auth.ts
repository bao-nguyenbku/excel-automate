import type { LoginCredentials } from '../../types';

export const visitAndLoginWithCredentials = (opts: LoginCredentials) => {
  cy.visit(opts.loginUrl);
  cy.wait(2000);

  cy.get('#email').click().type(opts.loginEmail);
  cy.get('#email').should('have.value', opts.loginEmail);

  cy.get('#password').click().type(opts.loginPassword);
  cy.get('#password').should('have.value', opts.loginPassword);

  cy.get('[data-testid="login-submit-button"]').click();
  cy.wait(5000);
};
