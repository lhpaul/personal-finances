import DevSampleDataRoute from '../sample-data';

// `__DEV__` is declared `const` by React Native's ambient types, so it can't be reassigned
// through the bare identifier. It is a real, writable `globalThis` property at runtime (Metro
// defines it as a plain global), so a cast through `globalThis` lets this test flip it safely.
const globalWithDev = globalThis as unknown as { __DEV__: boolean };

describe('DevSampleDataRoute (implementation plan for issue #12, Decision 11 — production gating)', () => {
  const originalDev = globalWithDev.__DEV__;

  afterEach(() => {
    globalWithDev.__DEV__ = originalDev;
  });

  it('returns null when __DEV__ is false, without rendering anything or requiring the panel', () => {
    globalWithDev.__DEV__ = false;
    expect(DevSampleDataRoute()).toBeNull();
  });
});
