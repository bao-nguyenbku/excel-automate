/// <reference types="cypress" />

import type { AppendExcelRunLogOptions, ExcelWorkbook } from "../types";

declare global {
  namespace Cypress {
    interface Chainable {
      clickLoginAsWhenNotEnrolled(
        names: string[],
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
