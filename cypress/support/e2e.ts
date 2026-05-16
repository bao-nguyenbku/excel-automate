// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Live mode streams each command to the terminal during long single-`it` runs.
// Requires the consoleProcessor workaround in cypress.config.ts.
require("cypress-terminal-report/src/installLogsCollector")({
  enableContinuousLogging: true,
  xhr: {
    printBody: false,
    printHeaderData: false,
    printRequestData: false,
  },
});

// Native pointer events (CDP) — helps some controls (e.g. react-select in iframes).
import "cypress-real-events";

// Import commands.ts using ES2015 syntax:
import "./commands";
