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

      const header = extractCardHeader(logGroup);
      const balances = extractBalanceDetails(logGroup);
      const unbilledTransactions = extractTransactionsFromTable(logGroup, false, 0);

      const invoicedTabLink = document.querySelectorAll('.router-tab-link')[1];
      let billedTransactions = [];
      if (invoicedTabLink) {
        invoicedTabLink.click();
        ${generateExecutableStepFunction({
          stepName: 'wait-for-invoiced-tab',
          logGroup: LOG_GROUP,
          code: `
            await waitForPageToBeReady('${LOG_GROUP}');
            await waitFor${BCH_SUMMARY_LABEL}Element();
          `,
        })}
        billedTransactions = extractTransactionsFromTable(logGroup, true, unbilledTransactions.length);
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
      sendTrace({ logGroup: '${LOG_GROUP}', type: 'error', message: 'Credit card details script failed: ' + error.message });
    });
  `;
}

function extractCardHeaderHelper(): string {
  return `
    function extractCardHeader(logGroup) {
      const header = document.querySelector('.card-header');
      const label = header.querySelector('.label').textContent.trim();
      const last4Text = header.querySelector('.last4').textContent.trim();
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
        const balanceText = leadElement.getElementsByClassName('number')[0].textContent.trim();
        const bodyElement = section.getElementsByClassName('summary-body')[0];
        const creditLimitText = bodyElement.getElementsByClassName('number')[0].textContent.trim();
        return { balanceText: balanceText, creditLimitText: creditLimitText };
      }
      sendTrace({ logGroup, type: 'error', message: 'National balance summary not found' });
      return { balanceText: '$0', creditLimitText: '$0' };
    }
  `;
}

function extractTransactionsFromTableHelper(): string {
  return `
    function extractTransactionsFromTable(logGroup, billed, startingPosition) {
      const table = document.querySelector('.bch-table');
      if (!table) {
        sendTrace({ logGroup, message: 'No transactions table found' });
        return [];
      }
      const isInternational = table.querySelectorAll('thead th').length > 7;
      const rows = table.querySelectorAll('tbody tr');
      const transactions = [];
      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        const dateText = cells[0].textContent.trim();
        const rawDescription = cells[2].textContent.trim();
        let outgoingText = null;
        let incomingText = null;
        let extras = { billed: billed ? 'true' : 'false' };
        if (isInternational) {
          extras.country = cells[3].textContent.trim();
          const outgoingCell = cells[5] && cells[5].children[0];
          const incomingCell = cells[6] && cells[6].children[0];
          outgoingText = outgoingCell && outgoingCell.textContent.trim() ? outgoingCell.textContent.trim() : null;
          incomingText = incomingCell && incomingCell.textContent.trim() ? incomingCell.textContent.trim() : null;
        } else if (billed) {
          extras.installments = cells[3].textContent.trim();
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
