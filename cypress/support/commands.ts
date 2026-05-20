// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

import type { ClickLoginAsWhenNotEnrolledProps } from '../types';
import { normalizeName, normalizePhone } from './utils';

const getRowName = (rowEl: Element): string => {
  const el = rowEl.querySelector('.MuiTypography-root.MuiTypography-h5');
  return el?.textContent?.trim() ?? '';
};

/** Phone number lives in the scrollable grid cell `[data-field="phone"]`. */
const getRowPhone = (rowEl: Element): string => {
  const phoneCell = rowEl.querySelector('[data-field="phone"]');
  return phoneCell?.textContent?.trim() ?? '';
};

const rowMatchesNames = (rowEl: Element, names: string[]) =>
  names.some((name) => normalizeName(name) === normalizeName(getRowName(rowEl)));

const rowMatchesPhone = (rowEl: Element, phoneNumber: string) => {
  const expected = normalizePhone(phoneNumber);
  if (!expected) return false;
  return normalizePhone(getRowPhone(rowEl)) === expected;
};

const clickLoginAsOnRow = (matchedRow: Element, timeout: number) => {
  const rowId = matchedRow.getAttribute('data-id');
  if (!rowId) {
    cy.log(`Row id missing: skip`);
    return cy.wrap(false, { log: false });
  }

  return cy
    .get(`.MuiDataGrid-virtualScrollerRenderZone .MuiDataGrid-row[data-id="${rowId}"] [data-field="status_label"]`, {
      timeout,
    })
    .then(($statusCells) => {
      if (!$statusCells.length) {
        cy.log(`No status cell: skip`);
        return cy.wrap(false, { log: false });
      }

      const statusText = String($statusCells.first().text()).trim();
      if (/^enrolled$/i.test(statusText)) {
        cy.log(`Enrolled: skip Login as`);
        return cy.wrap(false, { log: false });
      }

      return cy
        .get(`.MuiDataGrid-virtualScrollerContent .MuiDataGrid-row[data-id="${rowId}"] button`, { timeout })
        .then(($buttons) => {
          const matchedButtons = $buttons.filter((_, btnEl) =>
            /^login as(\.\.\.)?$/i.test(String(btnEl.textContent).trim()),
          );

          if (!matchedButtons.length) {
            cy.log(`No Login as button: skip`);
            return cy.wrap(false, { log: false });
          }

          return cy
            .wrap(matchedButtons.first())
            .click()
            .then(() => cy.wrap(true, { log: false }));
        });
    });
};

Cypress.Commands.add(
  'clickLoginAsWhenNotEnrolled',
  (props: ClickLoginAsWhenNotEnrolledProps, options: { timeout?: number } = {}) => {
    const { names, phoneNumber } = props;
    if (Array.isArray(names) && names.length === 0 && !phoneNumber?.trim()) {
      cy.log('clickLoginAsWhenNotEnrolled: empty names and phone, skip');
      return cy.wrap(false, { log: false });
    }

    const timeout = options.timeout ?? 10000;

    return cy.get('.MuiDataGrid-pinnedColumns--left .MuiDataGrid-row', { timeout }).then(($pinnedRows) => {
      const fromName = Array.from($pinnedRows).find((rowEl) => rowMatchesNames(rowEl, names));
      if (fromName) {
        return clickLoginAsOnRow(fromName, timeout);
      }

      if (!phoneNumber?.trim()) {
        cy.log(`No row found for "${phoneNumber}" - skip`);
        return cy.wrap(false, { log: false });
      }

      return cy.get('.MuiDataGrid-virtualScrollerRenderZone .MuiDataGrid-row', { timeout }).then(($virtualRows) => {
        const fromPhone = Array.from($virtualRows).find((rowEl) => rowMatchesPhone(rowEl, phoneNumber));
        if (!fromPhone) {
          cy.log(`No row found for "${names.join(', ')}" or phone ${phoneNumber} - skip`);
          return cy.wrap(false, { log: false });
        }
        return clickLoginAsOnRow(fromPhone, timeout);
      });
    });
  },
);
