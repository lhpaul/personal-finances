import { commonHelperFunctions, generateExecutableStepFunction, generateInstanceIdHelperFunction, generateWaitForElementHelperFunctions } from '../../../scripts/script-utils';
import { BANCO_DE_CHILE_BANK_ID } from './banco-de-chile.constants';

/**
 * Banco de Chile's product-list routine (spec Use Case 1, AC1, AC6, AC24, AC25; implementation
 * plan Decision 1, Decision 6).
 *
 * Posts **raw structural facts** only (`RawProductPayload`) — `balanceText` stays a bank-formatted
 * string, parsed on the React Native side by `parseMinorUnits`. The opaque `instanceId` is
 * computed **inside the page** via `computeInstanceId` (Decision 6) so the raw account number
 * never crosses the bridge. The outgoing object is built from an explicit allow-list of keys
 * (`toReportedProduct`) so an internal field (`__clickIndex`) cannot leak by accident.
 */

const ACCOUNT_ITEMS_SELECTOR = "document.querySelectorAll('.bch-card.card-cuentas')";
const ACCOUNT_ITEMS_LABEL = 'AccountItems';
const LOG_GROUP = 'get-products';
const GO_TO_NEXT_PRODUCT_PAGE_LOG_GROUP = 'go-to-next-product-page';

export function homeScript(): string {
  return `
    ${commonHelperFunctions()}
    ${generateInstanceIdHelperFunction()}
    ${generateWaitForElementHelperFunctions({ label: ACCOUNT_ITEMS_LABEL, selector: `${ACCOUNT_ITEMS_SELECTOR}[0]` })}
    ${reportExtractionFailureHelper()}
    ${extractAccountsHelper()}
    ${extractCreditCardsHelper()}
    ${toReportedProductHelper()}
    ${goToNextProductPageHelper()}

    if (!window.globalVariables) {
      window.globalVariables = { currentProductIndexes: { accounts: 0, creditCards: 0 } };
    }

    (async function () {
      const globalVariables = window.globalVariables;

      if (globalVariables.products) {
        sendTrace({ logGroup: '${GO_TO_NEXT_PRODUCT_PAGE_LOG_GROUP}', message: 'products already extracted, going to next product page' });
        ${generateExecutableStepFunction({
          stepName: 'wait-for-page-to-be-ready',
          logGroup: GO_TO_NEXT_PRODUCT_PAGE_LOG_GROUP,
          code: `
            await waitForPageToBeReady('${GO_TO_NEXT_PRODUCT_PAGE_LOG_GROUP}');
            await waitFor${ACCOUNT_ITEMS_LABEL}Element();
          `,
        })}
        ${generateExecutableStepFunction({
          stepName: 'go-to-next-product-page',
          logGroup: GO_TO_NEXT_PRODUCT_PAGE_LOG_GROUP,
          code: 'goToNextProductPage();',
        })}
        return;
      }

      sendTrace({ logGroup: '${LOG_GROUP}', message: 'Starting home script' });

      ${generateExecutableStepFunction({
        stepName: 'wait-for-page-to-be-ready',
        logGroup: LOG_GROUP,
        code: `
          await waitForPageToBeReady('${LOG_GROUP}');
          await waitFor${ACCOUNT_ITEMS_LABEL}Element();
        `,
      })}

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
      }));

      ${generateExecutableStepFunction({
        stepName: 'extract-accounts',
        logGroup: LOG_GROUP,
        code: `globalVariables.extractedAccounts = await extractAccounts('${LOG_GROUP}');`,
      })}

      ${generateExecutableStepFunction({
        stepName: 'extract-credit-cards',
        logGroup: LOG_GROUP,
        code: `globalVariables.extractedCreditCards = await extractCreditCards('${LOG_GROUP}');`,
      })}

      globalVariables.products = {
        accounts: globalVariables.extractedAccounts,
        creditCards: globalVariables.extractedCreditCards,
      };

      const reportedProducts = globalVariables.extractedAccounts.map(toReportedProduct)
        .concat(globalVariables.extractedCreditCards.map(toReportedProduct));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-transactions-start',
        progress: 0.7,
        data: { products: reportedProducts },
      }));

      goToNextProductPage();
    })().then(function () {
      sendTrace({ logGroup: '${LOG_GROUP}', message: 'Home script finished' });
    }).catch(function (error) {
      sendTrace({ logGroup: '${LOG_GROUP}', type: 'error', message: 'Home script failed: ' + error.message });
    });
  `;
}

function extractAccountsHelper(): string {
  return `
    async function extractAccounts(logGroup) {
      const accountItems = document.querySelectorAll('.bch-card.card-cuentas');
      const products = [];
      for (let index = 0; index < accountItems.length; index++) {
        const item = accountItems[index];
        try {
          const itemText = item.textContent ? item.textContent.trim() : '';
          if (!itemText) {
            sendTrace({ logGroup, message: 'No account text found in index ' + index });
            continue;
          }
          // Split on any run of two-or-more whitespace characters, not exactly two space
          // characters — textContent concatenates the source markup's own whitespace, which for
          // a real Angular template is normally a newline plus indentation, not two literal
          // spaces (CodeRabbit finding #10). This is a robustness improvement, not a guaranteed
          // match for the live page's exact whitespace (fixtures are hand-authored, Documented
          // Deviation D3).
          const splitItemText = itemText.split(/\\s{2,}/).filter(function (part) { return part.trim().length > 0; });
          const accountTypeLabel = splitItemText[0] ? splitItemText[0].trim() : '';
          const accountNumberString = splitItemText[1] || '';
          const balanceText = splitItemText[splitItemText.length - 1];
          const accountNumberDigits = accountNumberString.replace(/[^0-9]/g, '');
          if (!accountNumberDigits) {
            sendTrace({ logGroup, message: 'No valid account number found in index ' + index });
            continue;
          }

          let kindKey;
          if (accountTypeLabel.indexOf('FAN') !== -1) {
            kindKey = 'cuenta-fan';
          } else if (accountTypeLabel.indexOf('Corriente') !== -1) {
            kindKey = 'cuenta-corriente';
          } else if (accountTypeLabel.indexOf('Vista') !== -1) {
            kindKey = 'cuenta-vista';
          } else if (accountTypeLabel.toLowerCase().indexOf('crédito') !== -1 || accountTypeLabel.toLowerCase().indexOf('credito') !== -1) {
            kindKey = 'linea-de-credito';
          } else {
            kindKey = 'unknown-' + accountTypeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          }

          const instanceId = await computeInstanceId('${BANCO_DE_CHILE_BANK_ID}', kindKey, accountNumberDigits);
          const maskedIdentifier = '••••' + accountNumberDigits.slice(-4);

          products.push({
            instanceId: instanceId,
            kindKey: kindKey,
            displayName: accountTypeLabel,
            currencyCode: 'CLP',
            maskedIdentifier: maskedIdentifier,
            balanceText: balanceText,
            __clickIndex: index,
          });
          sendTrace({ logGroup, message: 'Product added', data: { kindKey: kindKey } });
        } catch (itemError) {
          sendTrace({ logGroup, type: 'error', message: 'Error processing account item at index ' + index + ': ' + itemError.message });
          await reportExtractionFailure('account', index);
        }
      }
      return products;
    }
  `;
}

function reportExtractionFailureHelper(): string {
  return `
    // A dropped account or credit card previously left no trace in the read's outcome: the
    // caller cannot distinguish "this customer has two accounts" from "this customer has three
    // accounts and we failed to read one" (CodeRabbit finding #11). Report it as a product
    // failure, scoped by a synthetic per-item instanceId (there is no real instanceId — the
    // failure happened before one could be computed) — this degrades the read's outcome to
    // 'partial' instead of silently reporting 'complete'.
    async function reportExtractionFailure(kindLabel, index) {
      try {
        const failureInstanceId = await computeInstanceId('${BANCO_DE_CHILE_BANK_ID}', kindLabel + '-extraction-failure', String(index));
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: 'error',
          data: { code: 'parse_failed', productInstanceId: failureInstanceId },
        }));
      } catch (hashError) {
        // crypto.subtle unavailable — nothing more to attach the failure to; the caller's own
        // trace is the only diagnostic available in that case.
      }
    }
  `;
}

function extractCreditCardsHelper(): string {
  return `
    async function extractCreditCards(logGroup) {
      const creditCards = [];
      const section = document.querySelector('.card-products');
      if (!section) {
        sendTrace({ logGroup, message: 'Credit cards section not found' });
        return creditCards;
      }
      const elements = section.querySelectorAll('.link-card');
      for (let index = 0; index < elements.length; index++) {
        const element = elements[index];
        try {
          const last4Parts = element.children[0].children[1].innerHTML.trim().split(' ');
          const last4 = last4Parts[last4Parts.length - 1];
          const label = element.children[1].children[0].innerHTML.trim();
          const labelParts = label.split(' ');
          const category = labelParts[labelParts.length - 1].toLowerCase();
          const brandMatch = label.match(/(visa|mastercard|american express|amex)/i);
          const brand = brandMatch ? brandMatch[1].toLowerCase() : 'unknown';

          if (!last4) {
            sendTrace({ logGroup, type: 'error', message: 'No valid card number found in index ' + index });
            continue;
          }

          const kindKey = 'tarjeta-credito';
          // Identity is derived from brand + last4 only, not category (CodeRabbit finding #12):
          // category comes from the label's own wording ('Nacional'/'Internacional'), which can
          // shift with casing, accents, or the bank's own copy changes. brand + last4 is the
          // stable pair that actually distinguishes one physical card from another; category is
          // still reported as a display field below, just not fed into the opaque identity.
          const rawIdentifier = brand + '|' + last4;
          const instanceId = await computeInstanceId('${BANCO_DE_CHILE_BANK_ID}', kindKey, rawIdentifier);

          creditCards.push({
            instanceId: instanceId,
            kindKey: kindKey,
            displayName: label,
            currencyCode: 'CLP',
            maskedIdentifier: '••••' + last4,
            // No balanceText key at all (CodeRabbit finding #13): the home page does not expose a
            // credit card's real balance, only its own details page does. A fabricated '$0' would
            // be indistinguishable from a genuinely-zero balance if the details page read never
            // completes.
            cardBrand: brand,
            cardCategory: category,
            cardLast4: last4,
            __clickIndex: index,
          });
        } catch (itemError) {
          sendTrace({ logGroup, type: 'error', message: 'Error processing credit card element at index ' + index + ': ' + itemError.message });
          await reportExtractionFailure('credit-card', index);
        }
      }
      return creditCards;
    }
  `;
}

function toReportedProductHelper(): string {
  return `
    function toReportedProduct(p) {
      const reported = {
        instanceId: p.instanceId,
        kindKey: p.kindKey,
        displayName: p.displayName,
        currencyCode: p.currencyCode,
        maskedIdentifier: p.maskedIdentifier,
      };
      // balanceText is optional (CodeRabbit finding #13) — a credit card discovered here has no
      // balance to report until its own details page is visited; omit the key rather than
      // fabricating one.
      if (p.balanceText !== undefined) reported.balanceText = p.balanceText;
      if (p.cardBrand !== undefined) reported.cardBrand = p.cardBrand;
      if (p.cardCategory !== undefined) reported.cardCategory = p.cardCategory;
      if (p.cardLast4 !== undefined) reported.cardLast4 = p.cardLast4;
      return reported;
    }
  `;
}

function goToNextProductPageHelper(): string {
  return `
    function goToNextProductPage() {
      const globalVariables = window.globalVariables;
      const accounts = globalVariables.products.accounts;
      const creditCards = globalVariables.products.creditCards;
      const accountsIndex = globalVariables.currentProductIndexes.accounts;
      const creditCardsIndex = globalVariables.currentProductIndexes.creditCards;

      // Three unguarded dereferences here previously threw uncaught if the product list
      // re-rendered with fewer items or the credit-card section disappeared between page loads
      // (CodeRabbit finding #14). Each guard below reports parse_failed for that specific
      // product — whose instanceId is already known, since it was extracted successfully earlier
      // — and advances past it instead of throwing.
      if (accountsIndex < accounts.length) {
        const currentAccount = accounts[accountsIndex];
        const accountItems = document.querySelectorAll('.bch-card.card-cuentas');
        const target = accountItems[currentAccount.__clickIndex];
        globalVariables.currentProductIndexes.accounts++;
        if (!target) {
          sendTrace({ logGroup: '${GO_TO_NEXT_PRODUCT_PAGE_LOG_GROUP}', type: 'error', message: 'Account item not found at click index ' + currentAccount.__clickIndex });
          window.ReactNativeWebView.postMessage(JSON.stringify({
            eventType: 'error',
            data: { code: 'parse_failed', productInstanceId: currentAccount.instanceId },
          }));
          return;
        }
        window.productId = currentAccount.instanceId;
        const clickable = target.querySelector('.clickable') || target;
        clickable.click();
        return;
      }

      if (creditCardsIndex < creditCards.length) {
        const currentCard = creditCards[creditCardsIndex];
        const cardSection = document.querySelector('.card-products');
        const cardElements = cardSection ? cardSection.querySelectorAll('.link-card') : [];
        const target = cardElements[currentCard.__clickIndex];
        globalVariables.currentProductIndexes.creditCards++;
        if (!target) {
          sendTrace({ logGroup: '${GO_TO_NEXT_PRODUCT_PAGE_LOG_GROUP}', type: 'error', message: 'Credit card element not found at click index ' + currentCard.__clickIndex });
          window.ReactNativeWebView.postMessage(JSON.stringify({
            eventType: 'error',
            data: { code: 'parse_failed', productInstanceId: currentCard.instanceId },
          }));
          return;
        }
        window.productId = currentCard.instanceId;
        target.click();
        return;
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'ready',
        progress: 1,
      }));
    }
  `;
}
