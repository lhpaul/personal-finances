import type { AppDatabase, SyncConnection } from '../../../db/types';
import type { ScraperRunner, SyncRunResult } from '../../sync';
import { resolveRetryDecision, runAttempt, type AttemptOutcome, type RunAttemptDeps } from '../use-bank-sync';

// `jest.mock` calls are hoisted above every import by `babel-plugin-jest-hoist` (found in
// review — keeping the import with its siblings above clears the `import/first` lint warning,
// `use-home-data.test.ts`'s own precedent). `use-bank-sync.ts` statically imports
// `use-scraper-runner.tsx`, which statically imports the deep `@finanzas/bank-scraper/src/component`
// — a real `react-native-webview` native module the Jest environment cannot resolve. This suite
// exercises `runAttempt` / `resolveRetryDecision` as plain functions (no rendering, no runner
// interaction), so a trivial stand-in is enough to let the module graph load.
jest.mock('@finanzas/bank-scraper/src/component', () => ({ BankScraperComponent: () => null }));

const FAKE_RUNNER: ScraperRunner = { run: jest.fn() };
const FAKE_DB = {} as AppDatabase;

function buildDeps(overrides: Partial<RunAttemptDeps> = {}): RunAttemptDeps {
  return {
    db: FAKE_DB,
    runner: FAKE_RUNNER,
    runSync: jest.fn(),
    getConnection: jest.fn(),
    ...overrides,
  };
}

/** Testing Strategy scenarios 14-18 (implementation plan, issue #11). */
describe('runAttempt (scenario 14; Decision 6; concurrency: re-entrancy)', () => {
  it('a refused result maps to phase "refused" with the read_in_progress body, and getConnection is never called', async () => {
    const getConnection = jest.fn();
    const runSync = jest.fn().mockResolvedValue({ status: 'refused', reason: 'read_in_progress' } satisfies SyncRunResult);

    const outcome = await runAttempt(buildDeps({ runSync, getConnection }), { connectionId: 'conn-1' });

    expect(outcome).toEqual({ phase: 'refused', failure: { reasonCode: 'read_in_progress' } });
    expect(getConnection).not.toHaveBeenCalled();
  });
});

describe('runAttempt (Decision 6): completed outcomes', () => {
  it('connectionState.syncStatus "ok" maps to phase "succeeded" with no failure', async () => {
    const runSync = jest.fn().mockResolvedValue({
      status: 'completed',
      summary: {} as never,
      connectionState: { syncStatus: 'ok' } as SyncConnection,
    } satisfies SyncRunResult);

    const outcome = await runAttempt(buildDeps({ runSync }), { connectionId: 'conn-1' });
    expect(outcome).toEqual({ phase: 'succeeded', failure: null });
  });

  it('connectionState.syncStatus "idle" maps to phase "stopped" with no failure (Assumption A1, Decision 9)', async () => {
    const runSync = jest.fn().mockResolvedValue({
      status: 'completed',
      summary: {} as never,
      connectionState: { syncStatus: 'idle' } as SyncConnection,
    } satisfies SyncRunResult);

    const outcome = await runAttempt(buildDeps({ runSync }), { connectionId: 'conn-1' });
    expect(outcome).toEqual({ phase: 'stopped', failure: null });
  });

  it.each(['invalid_credentials', 'session_closed', 'network', 'parse_failed'] as const)(
    'scenario 15: connectionState.syncStatus "error" with lastErrorCode %s maps to the matching failure',
    async (lastErrorCode) => {
      const runSync = jest.fn().mockResolvedValue({
        status: 'completed',
        summary: {} as never,
        connectionState: { syncStatus: 'error' } as SyncConnection,
      } satisfies SyncRunResult);
      const getConnection = jest.fn().mockReturnValue({ lastErrorCode });

      const outcome = await runAttempt(buildDeps({ runSync, getConnection }), { connectionId: 'conn-1' });
      expect(outcome).toEqual({ phase: 'failed', failure: { reasonCode: lastErrorCode } });
      expect(getConnection).toHaveBeenCalledWith(FAKE_DB, 'conn-1');
    },
  );

  it('scenario 15: a null lastErrorCode falls back to parse_failed', async () => {
    const runSync = jest.fn().mockResolvedValue({
      status: 'completed',
      summary: {} as never,
      connectionState: { syncStatus: 'error' } as SyncConnection,
    } satisfies SyncRunResult);
    const getConnection = jest.fn().mockReturnValue({ lastErrorCode: null });

    const outcome = await runAttempt(buildDeps({ runSync, getConnection }), { connectionId: 'conn-1' });
    expect(outcome).toEqual({ phase: 'failed', failure: { reasonCode: 'parse_failed' } });
  });

  it('scenario 15: an undefined connection row (vanished mid-sync) also falls back to parse_failed', async () => {
    const runSync = jest.fn().mockResolvedValue({
      status: 'completed',
      summary: {} as never,
      connectionState: { syncStatus: 'error' } as SyncConnection,
    } satisfies SyncRunResult);
    const getConnection = jest.fn().mockReturnValue(undefined);

    const outcome = await runAttempt(buildDeps({ runSync, getConnection }), { connectionId: 'conn-1' });
    expect(outcome).toEqual({ phase: 'failed', failure: { reasonCode: 'parse_failed' } });
  });
});

describe('resolveRetryDecision (scenarios 16-18; Decision 8)', () => {
  it('scenario 18: no-op while no attempt has settled yet (null outcome — mirrors "reading")', () => {
    expect(resolveRetryDecision(null)).toEqual({ kind: 'noop' });
  });

  it('scenario 18: no-op for a non-terminal phase', () => {
    const outcome: AttemptOutcome = { phase: 'succeeded', failure: null };
    expect(resolveRetryDecision(outcome)).toEqual({ kind: 'noop' });
  });

  it('scenario 16: restart_read for a non-credential failure (session_closed) — the read re-runs in place', () => {
    const outcome: AttemptOutcome = { phase: 'failed', failure: { reasonCode: 'session_closed' } };
    expect(resolveRetryDecision(outcome)).toEqual({ kind: 'restart_read' });
  });

  it('restart_read for every other non-credential failure and for a refusal', () => {
    for (const reasonCode of ['network', 'parse_failed', 'read_in_progress'] as const) {
      const outcome: AttemptOutcome = { phase: 'failed', failure: { reasonCode } };
      expect(resolveRetryDecision(outcome)).toEqual({ kind: 'restart_read' });
    }
    const refused: AttemptOutcome = { phase: 'refused', failure: { reasonCode: 'read_in_progress' } };
    expect(resolveRetryDecision(refused)).toEqual({ kind: 'restart_read' });
  });

  it('scenario 17: reenter_credentials for invalid_credentials — the one exception', () => {
    const outcome: AttemptOutcome = { phase: 'failed', failure: { reasonCode: 'invalid_credentials' } };
    expect(resolveRetryDecision(outcome)).toEqual({ kind: 'reenter_credentials' });
  });
});
