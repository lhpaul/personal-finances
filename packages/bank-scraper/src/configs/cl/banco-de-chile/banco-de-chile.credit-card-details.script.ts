import { commonHelperFunctions, generateExecutableStepFunction, generateWaitForElementHelperFunctions } from '../../../scripts/script-utils';

/**
 * Banco de Chile's credit-card-details routine (spec Use Case 1, AC1, AC6, AC9, AC10, AC26;
 * implementation plan Decision 1, Business Rule 12).
 *
 * Posts raw structural facts only. The card's national balance and cupo update the product
 * already discovered by the home routine (merged by `instanceId`, Concurrency Safety Checklist);
 * an international movement is reported in its own currency (`USD`), never converted to CLP and
 * never invented (spec Conflict 4, AC10) — the amount column itself is the foreign-currency
 * figure the bank shows, exactly as Business Rule 12's parsing convention expects.
 *
 * **Documented simplification from the source implementation**: the source navigates through
 * several months of invoiced statements via a `<mat-option>` dropdown. This port reads the
 * currently displayed unbilled table, then the currently displayed billed table (after clicking
 * the invoiced tab) — one billed month, not several. Multi-month invoiced navigation is not
 * re-implemented here; recorded openly, not left silent.
 */

const BCH_SUMMARY_LABEL = 'BchSummary';
const BCH_SUMMARY_SELECTOR = "document.getElementsByClassName('bch-summary')[0]";
const LOG_GROUP = 'get-credit-card-details';

export function creditCardDetailsScript(input: { priorMonths?: number } = {}): string {
  // `priorMonths` is accepted for signature compatibility (spec Decision 4) but not yet wired to
  // multi-month invoiced navigation — see the documented simplification above.
  void input;
  return `
    ${commonHelperFunctions()}
    ${generateWaitForElementHelperFunctions({ label: BCH_SUMMARY_LABEL, selector: BCH_SUMMARY_SELECTOR })}
    ${extractCardHeaderHelper()}
    ${extractBalanceDetailsHelper()}
    ${extractTransactionsFromTableHelper()}

    (async function () {
      const logGroup = '${LOG_GROUP}-product-' + window.productId;
      sendTrace({ logGroup, message: 'Starting credit card details script' });

      ${generateExecutableStepFunction({
        stepName: 'wait-for-page-to-be-ready',
        logGroup: LOG_GROUP,
        code: `
          await waitForPageToBeReady('${LOG_GROUP}');
          await waitFor${BCH_SUMMARY_LABEL}Element();
        `,
      })}

      // Wrapped in the shared step function (CodeRabbit finding #41): these three extractions
      // previously ran outside any step wrapper, so an unguarded DOM dereference (finding #43)
      // threw straight into the outer .catch(), which only posts a TRACE — the engine would then
      // wait out the full read deadline instead of seeing a proper parse_failed ERROR.
      let header;
      let balances;
      let unbilledTransactions;
      ${generateExecutableStepFunction({
        stepName: 'extract-card-details',
        logGroup: LOG_GROUP,
        code: `
          header = extractCardHeader(logGroup);
          balances = extractBalanceDetails(logGroup);
          unbilledTransactions = extractTransactionsFromTable(logGroup, false, 0);
        `,
      })}

      const invoicedTabLink = document.querySelectorAll('.router-tab-link')[1];
      let billedTransactions = [];
      if (invoicedTabLink) {
        invoicedTabLink.click();
        // Wrapped in a local try/catch (CodeRabbit finding #6): header, balances, and
        // unbilledTransactions already succeeded above. Without this, a transient failure to
        // load the billed tab — after generateExecutableStepFunction exhausts its own internal
        // retries and rethrows — would propagate to the outer .catch() below, which skips
        // building and posting reportedProduct/movements entirely, discarding data that was
        // already good. Falls through with billedTransactions = [] instead, the same way the
        // else branch already handles a missing tab link.
        try {
          ${generateExecutableStepFunction({
            stepName: 'wait-for-invoiced-tab',
            logGroup: LOG_GROUP,
            code: `
              await waitForPageToBeReady('${LOG_GROUP}');
              await waitFor${BCH_SUMMARY_LABEL}Element();
            `,
          })}
          ${generateExecutableStepFunction({
            stepName: 'extract-billed-transactions',
            logGroup: LOG_GROUP,
            code: `
              billedTransactions = extractTransactionsFromTable(logGroup, true, unbilledTransactions.length);
            `,
          })}
        } catch (billedError) {
          sendTrace({ logGroup, type: 'warning', message: 'Billed transactions unavailable: ' + billedError.message });
        }
      } else {
        // Indistinguishable from "genuinely no billed movements" otherwise (CodeRabbit finding #42).
        sendTrace({ logGroup, message: 'No invoiced tab link found; reporting unbilled transactions only' });
      }

      const reportedProduct = {
        instanceId: window.productId,
        kindKey: 'tarjeta-credito',
        displayName: header.displayName,
        currencyCode: 'CLP',
        maskedIdentifier: header.maskedIdentifier,
        balanceText: balances.balanceText,
        creditLimitText: balances.creditLimitText,
        cardBrand: header.cardBrand,
        cardCategory: header.cardCategory,
        cardLast4: header.cardLast4,
      };

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-transactions-start',
        progress: 0.9,
        data: {
          products: [reportedProduct],
          movements: unbilledTransactions.concat(billedTransactions),
        },
      }));

      const homeLink = document.querySelector('a.logo-banca');
      if (homeLink) homeLink.click();
    })().then(function () {
      sendTrace({ logGroup: '${LOG_GROUP}', message: 'Credit card details script finished' });
    }).catch(function (error) {
      // The step wrapper above already posts its own parse_failed ERROR on exhaustion; this is a
      // backstop for anything outside a wrapped step (building reportedProduct, posting the
      // result, the final navigation) so a failure there is never silently reduced to a TRACE-only
      // hang (CodeRabbit finding #8's pattern, applied here too).
      sendTrace({ logGroup: '${LOG_GROUP}', type: 'error', message: 'Credit card details script failed: ' + error.message });
      // Skip when the step wrapper already posted its own parse_failed with the real attempts
      // count (CodeRabbit finding #4) — a second, no-attempts-field event here would silently
      // overwrite it in ScrapeSession's per-product failure map.
      if (!error.alreadyReportedFailure) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: 'error',
          data: { code: 'parse_failed', productInstanceId: window.productId },
        }));
      }
    });
  `;
}

function extractCardHeaderHelper(): string {
  return `
    // Each DOM lookup is guarded and throws a named error instead of a bare TypeError
    // (CodeRabbit finding #43) — the enclosing step wrapper (extract-card-details) reports a
    // precise cause in its parse_failed ERROR rather than an opaque "Cannot read properties of
    // null" message.
    function extractCardHeader(logGroup) {
      const header = document.querySelector('.card-header');
      if (!header) throw new Error('extractCardHeader: .card-header not found');
      const labelElement = header.querySelector('.label');
      if (!labelElement) throw new Error('extractCardHeader: .label not found');
      const label = labelElement.textContent.trim();
      const last4Element = header.querySelector('.last4');
      if (!last4Element) throw new Error('extractCardHeader: .last4 not found');
      const last4Text = last4Element.textContent.trim();
      const last4Parts = last4Text.split(' ');
      const last4 = last4Parts[last4Parts.length - 1];
      const labelParts = label.split(' ');
      const category = labelParts[labelParts.length - 1].toLowerCase();
      const brandMatch = label.match(/(visa|mastercard|american express|amex)/i);
      const brand = brandMatch ? brandMatch[1].toLowerCase() : 'unknown';
      return {
        displayName: label,
        maskedIdentifier: '••••' + last4,
        cardBrand: brand,
        cardCategory: category,
        cardLast4: last4,
      };
    }
  `;
}

function extractBalanceDetailsHelper(): string {
  return `
    function extractBalanceDetails(logGroup) {
      const sections = document.getElementsByClassName('bch-summary');
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const title = section.getElementsByClassName('summary-header-title')[0];
        if (!title || title.textContent.indexOf('Nacional') === -1) continue;
        const leadElement = section.getElementsByClassName('summary-header-lead')[0];
        const leadNumber = leadElement && leadElement.getElementsByClassName('number')[0];
        const bodyElement = section.getElementsByClassName('summary-body')[0];
        const bodyNumber = bodyElement && bodyElement.getElementsByClassName('number')[0];
        // Guarded (CodeRabbit finding #43): a markup change inside a matched "Nacional" section
        // must not silently reach a null .number lookup.
        if (!leadNumber || !bodyNumber) {
          throw new Error('extractBalanceDetails: national summary matched but its balance/cupo numbers were not found');
        }
        return { balanceText: leadNumber.textContent.trim(), creditLimitText: bodyNumber.textContent.trim() };
      }
      // No fabricated '$0' placeholder (CodeRabbit finding #44, Critical): parseMinorUnits('$0',
      // 'CLP') would succeed and store balanceMinorUnits: 0, indistinguishable from a genuinely
      // zero balance. Throwing here — instead of returning a value — lets the enclosing step
      // wrapper report a real parse_failed for this product.
      throw new Error('extractBalanceDetails: national balance summary not found');
    }
  `;
}

function extractTransactionsFromTableHelper(): string {
  return `
    // Selecting a currency by counting header cells conflated two different things: whether a
    // table is international vs. how wide it happens to be — a national table gaining one column
    // would then mislabel every movement as USD (CodeRabbit finding #46). Detecting an explicit
    // country-column header ties the distinction to the one signal that is actually about
    // internationality, not table width.
    function tableHasCountryColumn(table) {
      const headerCells = table.querySelectorAll('thead th');
      for (let i = 0; i < headerCells.length; i++) {
        const headerText = (headerCells[i].textContent || '').trim().toLowerCase().replace(/[íì]/g, 'i');
        if (headerText.indexOf('pais') !== -1) return true;
      }
      return false;
    }

    function extractTransactionsFromTable(logGroup, billed, startingPosition) {
      // Angular Material tab containers commonly keep an inactive tab's content mounted in the
      // DOM (CodeRabbit finding #45). A bare document.querySelector('.bch-table') always returns
      // the first match, so re-invoking this after switching to the invoiced tab could silently
      // re-read the unbilled table if both stay mounted. Best-effort mitigation, unverified
      // against a live page (fixtures are hand-authored, Documented Deviation D3): when more than
      // one .bch-table is present, the billed pass takes the last one, on the assumption that the
      // currently-active tab's table is the most recently rendered.
      const tables = document.querySelectorAll('.bch-table');
      const table = billed && tables.length > 1 ? tables[tables.length - 1] : tables[0];
      if (!table) {
        sendTrace({ logGroup, message: 'No transactions table found' });
        return [];
      }
      const isInternational = tableHasCountryColumn(table);
      const rows = table.querySelectorAll('tbody tr');
      const transactions = [];
      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        // Guarded (CodeRabbit finding #43): a markup change must not throw a bare TypeError with
        // no indication of which row or column is missing.
        if (!cells[0] || !cells[2]) {
          throw new Error('extractTransactionsFromTable: row ' + i + ' is missing an expected date or description cell');
        }
        const dateText = cells[0].textContent.trim();
        const rawDescription = cells[2].textContent.trim();
        let outgoingText = null;
        let incomingText = null;
        let extras = { billed: billed ? 'true' : 'false' };
        if (isInternational) {
          extras.country = cells[3] ? cells[3].textContent.trim() : '';
          const outgoingCell = cells[5] && cells[5].children[0];
          const incomingCell = cells[6] && cells[6].children[0];
          outgoingText = outgoingCell && outgoingCell.textContent.trim() ? outgoingCell.textContent.trim() : null;
          incomingText = incomingCell && incomingCell.textContent.trim() ? incomingCell.textContent.trim() : null;
        } else if (billed) {
          extras.installments = cells[3] ? cells[3].textContent.trim() : '';
          const outgoingCell = cells[4] && cells[4].children[0];
          const incomingCell = cells[5] && cells[5].children[0];
          outgoingText = outgoingCell && outgoingCell.textContent.trim() ? outgoingCell.textContent.trim() : null;
          incomingText = incomingCell && incomingCell.textContent.trim() ? incomingCell.textContent.trim() : null;
        } else {
          const outgoingCell = cells[5] && cells[5].children[0];
          const incomingCell = cells[6] && cells[6].children[0];
          outgoingText = outgoingCell && outgoingCell.textContent.trim() ? outgoingCell.textContent.trim() : null;
          incomingText = incomingCell && incomingCell.textContent.trim() ? incomingCell.textContent.trim() : null;
        }
        transactions.push({
          productInstanceId: window.productId,
          dateText: dateText,
          outgoingText: outgoingText,
          incomingText: incomingText,
          currencyCode: isInternational ? 'USD' : 'CLP',
          rawDescription: rawDescription,
          bankSuppliedId: null,
          positionInReadSnapshot: startingPosition + i,
          extras: extras,
        });
      }
      return transactions;
    }
  `;
}
