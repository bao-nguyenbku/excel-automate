/// <reference types="cypress" />

import type {
  AppendExcelRunLogOptions,
  ClickLoginAsWhenNotEnrolledProps,
  ExcelWorkbook,
} from '../types';

declare global {
  namespace Cypress {
    interface Chainable {
      clickLoginAsWhenNotEnrolled(
        props: ClickLoginAsWhenNotEnrolledProps,
        options?: { timeout?: number },
      ): Chainable<boolean>;
    }

    interface Tasks {
      readExcelFile(opts: { relativePath: string }): ExcelWorkbook;
      appendExcelRunLog(opts: AppendExcelRunLogOptions): null;
    }
  }
}

export {};
