import type { AppDatabase } from '../../../db/types';
import type { SecureStorePort } from '../../../lib/secure-store/types';
import { guardedDisconnect } from '../use-disconnect-bank';

jest.mock('../disconnect-bank.service', () => ({
  disconnectBank: jest.fn(() => Promise.resolve({ status: 'disconnected' })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- retrieving the mocked fn for call-count assertions
const { disconnectBank } = require('../disconnect-bank.service') as {
  disconnectBank: jest.Mock;
};

const fakeSecureStore: SecureStorePort = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  deleteItem: () => Promise.resolve(),
};

/** Implementation plan (issue #20) Testing Strategy, Scenario 7 — extracted from
 * `useDisconnectBank` so the guard is testable without a renderer (item #12 precedent). */
describe('guardedDisconnect', () => {
  beforeEach(() => {
    disconnectBank.mockClear();
  });

  it('runs disconnectBank when not already in flight', async () => {
    const inFlight = { current: false };
    const outcome = await guardedDisconnect({
      inFlight,
      getAppDatabase: () => Promise.resolve({} as AppDatabase),
      secureStore: fakeSecureStore,
      input: { connectionId: 'conn-1', institutionId: 'banco-de-chile' },
    });
    expect(outcome).toEqual({ status: 'disconnected' });
    expect(disconnectBank).toHaveBeenCalledTimes(1);
    expect(inFlight.current).toBe(false); // cleared after settling
  });

  it('a second call while inFlight is already true is a no-op (Scenario 7)', async () => {
    const inFlight = { current: true }; // simulates a first call already in progress
    const outcome = await guardedDisconnect({
      inFlight,
      getAppDatabase: () => Promise.resolve({} as AppDatabase),
      secureStore: fakeSecureStore,
      input: { connectionId: 'conn-1', institutionId: 'banco-de-chile' },
    });
    expect(outcome).toBeUndefined();
    expect(disconnectBank).not.toHaveBeenCalled();
    expect(inFlight.current).toBe(true); // left untouched — this call never owned the flag
  });

  it('clears inFlight even when getAppDatabase rejects', async () => {
    const inFlight = { current: false };
    await expect(
      guardedDisconnect({
        inFlight,
        getAppDatabase: () => Promise.reject(new Error('bootstrap failed')),
        secureStore: fakeSecureStore,
        input: { connectionId: 'conn-1', institutionId: 'banco-de-chile' },
      }),
    ).rejects.toThrow('bootstrap failed');
    expect(inFlight.current).toBe(false);
  });
});
