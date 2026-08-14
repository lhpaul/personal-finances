import { commonHelperFunctions, generateExecutableStepFunction, generateInstanceIdHelperFunction, generateWaitForElementHelperFunctions } from '../../../scripts/script-utils';
import { FALABELLA_BANK_ID } from './banco-falabella.constants';

/**
 * Banco Falabella's product list and movements live on a SPA: clicking a product does not change
 * the URL, so this one routine discovers products and then reads each product's table in turn.
 * Posted payloads are raw structural facts (`RawProductPayload` / `RawMovementPayload`) — no
 * `parseFloat`, no `Date`.
 */

const PRODUCT_LINK_SELECTOR = "document.querySelectorAll('a.div-product')";
const PRODUCT_LINK_LABEL = 'ProductLink';
const ACCOUNT_MOVEMENTS_TABLE_LABEL = 'AccountMovementsTable';
const LOG_GROUP = 'home';

export function homeScript(): string {
  return `
    ${commonHelperFunctions()}
    ${generateInstanceIdHelperFunction()}
    ${generateWaitForElementHelperFunctions({ label: PRODUCT_LINK_LABEL, selector: `${PRODUCT_LINK_SELECTOR}[0]` })}
    ${generateWaitForElementHelperFunctions({
      label: ACCOUNT_MOVEMENTS_TABLE_LABEL,
      selector: "document.getElementById('ctbListMovbfch')",
    })}
    ${extractProductsHelper()}
    ${toReportedProductHelper()}
    ${fetchAccountTransactionsHelper()}
    ${fetchCreditCardTransactionsHelper()}

    if (!window.globalVariables) {
      window.globalVariables = {};
    }

    (async function () {
      sendTrace({ logGroup: '${LOG_GROUP}', message: 'Starting home script' });

      ${generateExecutableStepFunction({
        stepName: 'wait-for-page-to-be-ready',
        logGroup: LOG_GROUP,
        code: `
          await waitForPageToBeReady('${LOG_GROUP}');
          await waitFor${PRODUCT_LINK_LABEL}Element();
        `,
      })}

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
      }));

      ${generateExecutableStepFunction({
        stepName: 'extract-products',
        logGroup: LOG_GROUP,
        code: `
          const extracted = await extractProducts('${LOG_GROUP}');
          window.globalVariables.accounts = extracted.accounts;
          window.globalVariables.creditCards = extracted.creditCards;
        `,
      })}

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-transactions-start',
        progress: 0.7,
        data: {
          products: [...window.globalVariables.accounts, ...window.globalVariables.creditCards].map(toReportedProduct),
        },
      }));

      ${generateExecutableStepFunction({
        stepName: 'scrape-product-transactions',
        logGroup: LOG_GROUP,
        code: 'await scrapeAllProductTransactions();',
      })}

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'ready',
        progress: 1,
      }));
    })().then(function () {
      sendTrace({ logGroup: '${LOG_GROUP}', message: 'Home script finished' });
    }).catch(function (error) {
      sendTrace({ logGroup: '${LOG_GROUP}', type: 'error', message: 'Home script failed: ' + error.message });
    });
  `;
}

function extractProductsHelper(): string {
  return `
    async function extractProducts(logGroup) {
      const accounts = [];
      const creditCards = [];
      const productLinks = document.querySelectorAll('a.div-product');
      for (let index = 0; index < productLinks.length; index++) {
        const link = productLinks[index];
        const elementId = link.id;
        const productName = link.querySelector('.product-name') ? link.querySelector('.product-name').textContent.trim() : '';
        const productCenterText = link.querySelector('.product-center') ? link.querySelector('.product-center').textContent.trim() : '';
        if (!productName || !productCenterText) continue;
        const numberText = productCenterText.replace(productName, '').replace(/\\s/g, '');
        try {
          if (elementId.indexOf('accountDetail') === 0) {
            const kindKey = 'cuenta-corriente';
            const instanceId = await computeInstanceId('${FALABELLA_BANK_ID}', kindKey, numberText);
            accounts.push({
              instanceId: instanceId,
              kindKey: kindKey,
              displayName: productName,
              currencyCode: 'CLP',
              maskedIdentifier: '••••' + numberText.slice(-4),
              __elementId: elementId,
            });
          } else if (elementId.indexOf('agreementDetail') === 0) {
            const kindKey = 'linea-de-credito';
            const instanceId = await computeInstanceId('${FALABELLA_BANK_ID}', kindKey, numberText);
            accounts.push({
              instanceId: instanceId,
              kindKey: kindKey,
              displayName: productName,
              currencyCode: 'CLP',
              maskedIdentifier: '••••' + numberText.slice(-4),
              __elementId: elementId,
            });
          } else if (elementId.indexOf('cardDetail') === 0) {
            const last4Match = numberText.match(/(\\d{4})/);
            const last4 = last4Match ? last4Match[1] : '';
            if (!last4) continue;
            const kindKey = 'tarjeta-credito';
            const instanceId = await computeInstanceId('${FALABELLA_BANK_ID}', kindKey, last4);
            creditCards.push({
              instanceId: instanceId,
              kindKey: kindKey,
              displayName: productName,
              currencyCode: 'CLP',
              maskedIdentifier: '••••' + last4,
              cardLast4: last4,
              __elementId: elementId,
            });
          }
        } catch (itemError) {
          sendTrace({ logGroup: logGroup, type: 'error', message: 'Error processing product at index ' + index + ': ' + itemError.message });
        }
      }
      const grids = document.querySelectorAll('.grid-container');
      for (let g = 0; g < grids.length; g++) {
        const grid = grids[g];
        const productLink = grid.querySelector('a.div-product');
        if (!productLink) continue;
        const product = accounts.concat(creditCards).find(function (p) { return p.__elementId === productLink.id; });
        if (!product) continue;
        const contentDivs = grid.querySelectorAll('.div-content');
        for (let d = 0; d < contentDivs.length; d++) {
          const amountEl = contentDivs[d].querySelector('.darker, .green-text-bold');
          const labelEl = contentDivs[d].querySelector('span');
          if (!amountEl || !labelEl) continue;
          const label = labelEl.textContent.trim();
          const amountText = amountEl.textContent.trim();
          if (label === 'Saldo contable') product.balanceText = amountText;
          if (label === 'Cupo autorizado' || label === 'Cupo de compras') product.creditLimitText = amountText;
        }
      }
      return { accounts: accounts, creditCards: creditCards };
    }

    async function scrapeAllProductTransactions() {
      const accounts = window.globalVariables.accounts;
      const creditCards = window.globalVariables.creditCards;
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        const target = document.getElementById(account.__elementId);
        if (!target) continue;
        window.productId = account.instanceId;
        target.click();
        await waitFor${ACCOUNT_MOVEMENTS_TABLE_LABEL}Element();
        const movements = fetchAccountTransactions(account.instanceId, '${LOG_GROUP}');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: 'state-change',
          stepId: 'get-transactions-start',
          progress: 0.8,
          data: { transactions: movements },
        }));
        const homeLink = document.getElementById('Inicio');
        if (homeLink) homeLink.click();
        await wait(200);
      }
      for (let i = 0; i < creditCards.length; i++) {
        const card = creditCards[i];
        const target = document.getElementById(card.__elementId);
        if (!target) continue;
        window.productId = card.instanceId;
        target.click();
        await wait(200);
        const movements = fetchCreditCardTransactions(card.instanceId, '${LOG_GROUP}');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: 'state-change',
          stepId: 'get-transactions-start',
          progress: 0.9,
          data: { transactions: movements },
        }));
        const homeLink = document.getElementById('Inicio');
        if (homeLink) homeLink.click();
        await wait(200);
      }
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
      if (p.balanceText !== undefined) reported.balanceText = p.balanceText;
      if (p.creditLimitText !== undefined) reported.creditLimitText = p.creditLimitText;
      if (p.cardLast4 !== undefined) reported.cardLast4 = p.cardLast4;
      return reported;
    }
  `;
}

function fetchAccountTransactionsHelper(): string {
  return `
    function fetchAccountTransactions(productInstanceId, logGroup) {
      const table = document.getElementById('ctbListMovbfch');
      if (!table) return [];
      const tbody = table.querySelector('tbody');
      if (!tbody) return [];
      const rows = tbody.querySelectorAll('tr');
      const transactions = [];
      let position = 0;
      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        if (cells.length < 4) continue;
        const dateText = cells[0].textContent.trim().replace(/-/g, '/');
        const rawDescription = cells[1].textContent.trim();
        const cargoText = cells[2].textContent.replace(/\\u00a0/g, '').trim();
        const abonoText = cells[3].textContent.replace(/\\u00a0/g, '').trim();
        const outgoingText = cargoText ? cargoText : null;
        const incomingText = !cargoText && abonoText ? abonoText : null;
        if (!outgoingText && !incomingText) continue;
        transactions.push({
          productInstanceId: productInstanceId,
          dateText: dateText,
          outgoingText: outgoingText,
          incomingText: incomingText,
          currencyCode: 'CLP',
          rawDescription: rawDescription,
          bankSuppliedId: null,
          positionInReadSnapshot: position,
          extras: {},
        });
        position += 1;
      }
      sendTrace({ logGroup: logGroup, message: 'Fetched ' + transactions.length + ' account transactions' });
      return transactions;
    }
  `;
}

function fetchCreditCardTransactionsHelper(): string {
  return `
    function getCreditCardTables() {
      let tables = document.querySelectorAll('table.container');
      if (tables.length > 0) return tables;
      const wc = document.querySelector('credit-card-movements');
      if (wc && wc.shadowRoot) {
        tables = wc.shadowRoot.querySelectorAll('table.container');
      }
      return tables;
    }

    function fetchCreditCardTransactions(productInstanceId, logGroup) {
      const tables = getCreditCardTables();
      const transactions = [];
      let position = 0;
      for (let t = 0; t < tables.length; t++) {
        const table = tables[t];
        const headerText = table.querySelector('thead th') ? table.querySelector('thead th').textContent.trim() : '';
        const isPending = headerText.indexOf('Pendientes') !== -1;
        const tbody = table.querySelector('tbody');
        if (!tbody) continue;
        const rows = tbody.querySelectorAll('tr');
        for (let i = 0; i < rows.length; i++) {
          const cells = rows[i].querySelectorAll('td');
          if (cells.length < 4) continue;
          const dateText = cells[0].textContent.trim();
          if (!dateText) continue;
          const rawDescription = cells[1].textContent.trim();
          const amountText = cells[3].textContent.trim();
          const cuotasText = cells.length > 4 ? cells[4].textContent.trim() : '';
          transactions.push({
            productInstanceId: productInstanceId,
            dateText: dateText,
            outgoingText: amountText,
            incomingText: null,
            currencyCode: 'CLP',
            rawDescription: rawDescription,
            bankSuppliedId: null,
            positionInReadSnapshot: position,
            extras: { billed: isPending ? 'false' : 'true', installments: cuotasText },
          });
          position += 1;
        }
      }
      sendTrace({ logGroup: logGroup, message: 'Total credit card transactions: ' + transactions.length });
      return transactions;
    }
  `;
}
