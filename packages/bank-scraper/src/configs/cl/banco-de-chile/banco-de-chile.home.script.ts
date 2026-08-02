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
          const splitItemText = itemText.split('  ').filter(function (part) { return part.trim().length > 0; });
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
        }
      }
      return products;
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
          const rawIdentifier = brand + '|' + category + '|' + last4;
          const instanceId = await computeInstanceId('${BANCO_DE_CHILE_BANK_ID}', kindKey, rawIdentifier);

          creditCards.push({
            instanceId: instanceId,
            kindKey: kindKey,
            displayName: label,
            currencyCode: 'CLP',
            maskedIdentifier: '••••' + last4,
            balanceText: '$0',
            cardBrand: brand,
            cardCategory: category,
            cardLast4: last4,
            __clickIndex: index,
          });
        } catch (itemError) {
          sendTrace({ logGroup, type: 'error', message: 'Error processing credit card element at index ' + index + ': ' + itemError.message });
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
        balanceText: p.balanceText,
      };
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

      if (accountsIndex < accounts.length) {
        const currentAccount = accounts[accountsIndex];
        window.productId = currentAccount.instanceId;
        const accountItems = document.querySelectorAll('.bch-card.card-cuentas');
        const target = accountItems[currentAccount.__clickIndex];
        const clickable = target.querySelector('.clickable') || target;
        clickable.click();
        globalVariables.currentProductIndexes.accounts++;
        return;
      }

      if (creditCardsIndex < creditCards.length) {
        const currentCard = creditCards[creditCardsIndex];
        window.productId = currentCard.instanceId;
        const cardElements = document.querySelector('.card-products').querySelectorAll('.link-card');
        cardElements[currentCard.__clickIndex].click();
        globalVariables.currentProductIndexes.creditCards++;
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
