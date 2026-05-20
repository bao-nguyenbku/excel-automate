/** Sync query on iframe body — avoids Cypress .find() retry when live fields are absent. */
export const liveFieldContainersInBody = ($body: JQuery<HTMLElement>) =>
  $body.find('div[data-testid="livefield"] .LiveField__container');

/** Top-level question roots inside a section (e.g. Paperform). */
export const liveFieldsInBody = ($body: JQuery<HTMLElement>) => $body.find('div[data-testid="livefield"]');

/** Reads leading question id from label text (e.g. "A1a.", "C5. ..."). */
export const parseFieldCodeFromLiveField = ($lf: JQuery<HTMLElement>) => {
  const headerText = $lf.find('label.LiveField__header').first().text().trim();
  if (!headerText) {
    return null;
  }
  const m = headerText.match(/^([A-Za-z]\d+[a-z]?)(?:\.|\s|$)/);
  if (!m) {
    return null;
  }
  const raw = m[1];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

export const getIframeDocument = () => {
  return cy
    .get('iframe', { timeout: 30000 })
    .should(($iframes) => {
      const readyIframe = Array.from($iframes).find((iframeEl) => {
        const doc = iframeEl.contentDocument;
        const href = iframeEl.contentWindow?.location?.href || iframeEl.contentDocument?.URL;
        return !!doc && !!doc.body && doc.body.childElementCount > 0 && href && href !== 'about:blank';
      });
      expect(readyIframe, 'an iframe loaded with non-blank content').to.exist;
    })
    .then(($iframes) => {
      const readyIframe = Array.from($iframes).find((iframeEl) => {
        const doc = iframeEl.contentDocument;
        const href = iframeEl.contentWindow?.location?.href || iframeEl.contentDocument?.URL;
        return !!doc && !!doc.body && doc.body.childElementCount > 0 && href && href !== 'about:blank';
      });
      if (!readyIframe?.contentDocument) {
        throw new Error('iframe document not available');
      }
      return readyIframe.contentDocument;
    });
};

export const getIframe = () => {
  return getIframeDocument()
    .its('body')
    .should('not.be.undefined')
    .should('not.be.empty')
    .then((body) => cy.wrap(Cypress.$(body)));
};
