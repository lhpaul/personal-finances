import type { DisconnectBankInput, DisconnectOutcome } from './disconnect-bank.service';

export interface ConfirmDisconnectArgs {
  /** The modal's target connection; `undefined` when the modal has no resolved target (a stale
   * route param) — the run is skipped entirely in that case. */
  connection: { id: string; institutionId: string } | undefined;
  run: (input: DisconnectBankInput) => Promise<DisconnectOutcome | undefined>;
  /** Fired only on `{ status: 'disconnected' }` — the caller closes the modal *and re-reads the
   * list* here (issue #111): the disconnect mutates rows in place with no focus change, so the
   * focus-driven reload in `use-bank-connections.ts` never fires on its own. A `'failed'`
   * outcome (or an in-flight no-op `undefined`) must not fire this: the modal stays open showing
   * the failure Note, and the list still reflects reality (nothing changed). */
  onDisconnected: () => void;
}

/**
 * The confirm-button behaviour of `settings-banks`' disconnect modal, extracted from the route so
 * it is testable without a renderer (the `runDisconnect`/`guardedDisconnect` split's precedent,
 * one level up).
 */
export async function confirmDisconnect({
  connection,
  run,
  onDisconnected,
}: ConfirmDisconnectArgs): Promise<void> {
  if (connection === undefined) return;
  const outcome = await run({ connectionId: connection.id, institutionId: connection.institutionId });
  if (outcome?.status === 'disconnected') onDisconnected();
}
