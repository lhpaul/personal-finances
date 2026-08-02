import { commonHelperFunctions, generateExecutableStepFunction, generateWaitForElementHelperFunctions } from '../../../scripts/script-utils';

/**
 * Banco de Chile's account-movements routine (spec Use Case 1, Use Case 4, AC1, AC6, AC11, AC12,
 * AC14 (via the generic step wrapper), AC22; implementation plan Decision 1, Business Rules 20-21,
 * 31).
 *
 * Posts **raw structural facts** only (`RawMovementPayload`) — dates and amounts stay
 * bank-formatted strings, parsed on the React Native side. `window.productId` (set by the home
 * script before clicking into this product) is embedded automatically in any `parse_failed`
 * this routine's steps report, scoping the failure to this product (Business Rule 31).
 *
 * **Documented simplification from the source implementation**: the source drives the bank's
 * calendar widget (open filter options, open the date picker, click through prior months) to
 * select the requested history window before reading the table. This port reads whatever table
 * is already on the page — pagination, the empty-statement case, and the stated-count-vs-parsed
 * mismatch (AC11, AC12, AC22) are ported faithfully, because those are the properties the spec's
 * acceptance criteria test — but the calendar-click mechanics that select *which* months are
 * shown are not re-implemented here. `priorMonths` is accepted for API-shape compatibility with
 * the plan (spec Decision 4: the history window is a parameter of the read) but is not yet wired
 * to a calendar interaction. Recorded as a known scope reduction, not a silent one.
 */

const MOVEMENTS_TABLE_TAG = 'fenix-movimientos-cuenta';
const MOVEMENTS_TABLE_LABEL = 'MovementsTable';
const MOVEMENTS_TABLE_SELECTOR = `document.getElementsByTagName('${MOVEMENTS_TABLE_TAG}')[0]`;
const LOG_GROUP = 'account-transactions';
// A generous, explicit bound on paginator clicks. No real statement has this many pages; this
// exists only to guarantee the pagination loop below always terminates (CodeRabbit finding #7)
// even if the bank ever renders the "next page" control in a state this script's disabled check
// does not recognize.
const MAX_PAGES = 500;
// A movement row always has exactly five <td> cells (date, description, blank, outgoing,
// incoming — see fetchTransactionsOfPageHelper). The live Angular Material table pairs each
// movement row with a hidden detail/expansion row (documented simplification below); checking
// the cell count structurally filters out any row shape other than a movement row, rather than
// assuming every <tr> is one (CodeRabbit finding #9).
const MOVEMENT_ROW_CELL_COUNT = 5;

export function accountTransactionsScript(input: { priorMonths?: number } = {}): string {
  // `priorMonths` is accepted for signature compatibility (spec Decision 4) but not yet wired to
  // a calendar interaction — see the documented simplification above.
  void input;
  return `
    ${commonHelperFunctions()}
    ${generateWaitForElementHelperFunctions({
      label: MOVEMENTS_TABLE_LABEL,
      selector: `(${MOVEMENTS_TABLE_SELECTOR} || document.getElementsByClassName('alert-warning')[0])`,
    })}
    ${fetchTransactionsOfPageHelper()}

    (async function () {
      const logGroup = '${LOG_GROUP}-product-' + window.productId;
      sendTrace({ logGroup, message: 'Starting account transactions script' });

      ${generateExecutableStepFunction({
        stepName: 'wait-for-page-to-be-ready',
        logGroup: LOG_GROUP,
        code: `
          await waitForPageToBeReady('${LOG_GROUP}');
          await waitFor${MOVEMENTS_TABLE_LABEL}Element();
        `,
      })}

      const noMovementsWarning = document.getElementsByClassName('alert-warning');
      if (noMovementsWarning.length) {
        sendTrace({ logGroup, message: 'No movements found for this product' });
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: 'state-change',
          stepId: 'get-transactions-start',
          progress: 0.8,
          data: { movements: [] },
        }));
        history.back();
        return;
      }

      const paginatorLabels = document.getElementsByClassName('mat-paginator-label');
      const paginatorLabel = paginatorLabels[1] || paginatorLabels[0];
      // Number.parseInt(undefined, 10) is NaN, not null — normalize explicitly so the
      // stated-count check below can distinguish "no stated total" from "unparsable label"
      // instead of silently disabling itself (movements.length < NaN is always false).
      const parsedStatedTotal = paginatorLabel
        ? Number.parseInt((paginatorLabel.textContent || '').trim().split('de ')[1], 10)
        : Number.NaN;
      const statedTotal = Number.isNaN(parsedStatedTotal) ? null : parsedStatedTotal;

      const movements = [];
      let position = 0;
      let page = 1;
      let hitPageLimit = false;
      while (true) {
        const rowsInPage = fetchTransactionsOfPage(logGroup, position);
        for (let i = 0; i < rowsInPage.length; i++) {
          movements.push(rowsInPage[i]);
          position++;
        }
        sendTrace({ logGroup, message: 'Found ' + rowsInPage.length + ' rows in page ' + page });
        const nextPageButton = document.getElementsByClassName('mat-paginator-navigation-next')[0];
        // Angular Material does not guarantee the exhausted-page signal is an
        // HTMLButtonElement's disabled property — check aria-disabled and the disabled CSS
        // class too, so a markup change does not turn this into an infinite loop.
        const nextPageExhausted = !nextPageButton
          || nextPageButton.disabled
          || nextPageButton.getAttribute('aria-disabled') === 'true'
          || nextPageButton.classList.contains('mat-button-disabled');
        if (nextPageExhausted) {
          break;
        }
        if (page >= ${MAX_PAGES}) {
          hitPageLimit = true;
          break;
        }
        nextPageButton.click();
        await wait(200);
        page++;
      }

      if (hitPageLimit) {
        sendTrace({ logGroup, type: 'error', message: 'Reached the ' + ${MAX_PAGES} + '-page pagination limit without an exhausted paginator; stopping' });
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: 'error',
          data: { code: 'parse_failed', productInstanceId: window.productId, attempts: 1 },
        }));
        return;
      }

      if (statedTotal !== null && movements.length < statedTotal) {
        sendTrace({ logGroup, type: 'error', message: 'Parsed fewer movements than the bank stated: ' + movements.length + ' of ' + statedTotal });
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: 'error',
          data: { code: 'parse_failed', productInstanceId: window.productId, attempts: 1 },
        }));
        return;
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-transactions-start',
        progress: 0.8,
        data: { movements: movements },
      }));
      history.back();
    })().then(function () {
      sendTrace({ logGroup: '${LOG_GROUP}', message: 'Account transactions script finished' });
    }).catch(function (error) {
      // An unguarded DOM dereference above throws into this catch instead of the retry wrapper
      // (that code deliberately runs outside generateExecutableStepFunction — pagination and the
      // stated-count check need to see the accumulated movements). Without this ERROR, the engine
      // would see only a TRACE and wait for the full read deadline (CodeRabbit finding #8).
      sendTrace({ logGroup: '${LOG_GROUP}', type: 'error', message: 'Account transactions script failed: ' + error.message });
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

function fetchTransactionsOfPageHelper(): string {
  return `
    function fetchTransactionsOfPage(logGroup, startingPosition) {
      const movements = [];
      const table = ${MOVEMENTS_TABLE_SELECTOR};
      if (!table) return movements;
      const body = table.getElementsByTagName('tbody')[0];
      if (!body) return movements;
      const rows = body.getElementsByTagName('tr');
      // Documented simplification: the source skips every other <tr> (rows[i += 2]) because the
      // live Angular Material table pairs each movement row with a hidden detail/expansion row.
      // Rather than assuming every <tr> is a movement row (or hard-coding a stride that could be
      // wrong), filter structurally: only a row with exactly MOVEMENT_ROW_CELL_COUNT cells is
      // treated as a movement (CodeRabbit finding #9) — a differently-shaped detail/expansion row
      // is skipped with a trace instead of producing a garbage movement or throwing.
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (row.children.length !== ${MOVEMENT_ROW_CELL_COUNT}) {
          sendTrace({ logGroup, message: 'Skipped a row with ' + row.children.length + ' cells (expected ' + ${MOVEMENT_ROW_CELL_COUNT} + ')' });
          continue;
        }
        const dateText = row.children[0].innerHTML.trim();
        const rawDescription = row.children[1].innerHTML.trim();
        const outgoingCell = row.children[3] && row.children[3].children[0];
        const incomingCell = row.children[4] && row.children[4].children[0];
        const outgoingText = outgoingCell && outgoingCell.innerHTML.trim() ? outgoingCell.innerHTML.trim() : null;
        const incomingText = incomingCell && incomingCell.innerHTML.trim() ? incomingCell.innerHTML.trim() : null;
        movements.push({
          productInstanceId: window.productId,
          dateText: dateText,
          outgoingText: outgoingText,
          incomingText: incomingText,
          currencyCode: 'CLP',
          rawDescription: rawDescription,
          bankSuppliedId: null,
          // Position counts accepted movements, not <tr> elements (CodeRabbit finding #5): using
          // the row index i means a skipped detail row (finding #9's own filter, above) makes
          // this counter diverge from the caller's own position variable (incremented once per
          // accepted movement). The two counters then collide across pages: the engine keys its
          // movement map by productInstanceId plus positionInReadSnapshot, so one real movement
          // silently overwrites another with no error, and skipped rows leave gaps that break the
          // AC22 guarantee that two identical-looking movements stay distinguishable by position.
          positionInReadSnapshot: startingPosition + movements.length,
          extras: {},
        });
      }
      return movements;
    }
  `;
}
