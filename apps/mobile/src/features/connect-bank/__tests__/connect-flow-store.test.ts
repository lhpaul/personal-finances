import {
  __resetConnectFlowForTests,
  chooseInstitution,
  enterFlow,
  getSnapshot,
  reset,
  subscribe,
} from '../connect-flow-store';

/** Implementation plan Decision 1 — the store's type is closed by construction. */

afterEach(() => {
  __resetConnectFlowForTests();
});

describe('connect-flow-store', () => {
  it('starts with no institution chosen', () => {
    expect(getSnapshot()).toEqual({ institutionId: null, entryOrigin: 'onboarding' });
  });

  it('enterFlow records the entry origin and clears any previously chosen institution', () => {
    chooseInstitution('banco-de-chile');
    enterFlow('settings');
    expect(getSnapshot()).toEqual({ institutionId: null, entryOrigin: 'settings' });
  });

  it('chooseInstitution updates institutionId without changing entryOrigin', () => {
    enterFlow('settings');
    chooseInstitution('banco-de-chile');
    expect(getSnapshot()).toEqual({ institutionId: 'banco-de-chile', entryOrigin: 'settings' });
  });

  it('reset clears both fields back to the initial snapshot', () => {
    enterFlow('settings');
    chooseInstitution('banco-de-chile');
    reset();
    expect(getSnapshot()).toEqual({ institutionId: null, entryOrigin: 'onboarding' });
  });

  it('notifies subscribers on every mutation', () => {
    const listener = jest.fn();
    const unsubscribe = subscribe(listener);
    chooseInstitution('banco-de-chile');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    chooseInstitution('santander');
    expect(listener).toHaveBeenCalledTimes(1); // unsubscribed — no further calls
  });

  it("the snapshot's own keys are exactly institutionId and entryOrigin — no credential field ever sneaks in", () => {
    enterFlow('onboarding');
    chooseInstitution('banco-de-chile');
    expect(Object.keys(getSnapshot()).sort()).toEqual(['entryOrigin', 'institutionId']);
  });
});
