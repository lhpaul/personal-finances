import { __resetReadLockForTests, acquireReadLock, isReadInProgress } from '../sync-lock';

/**
 * Implementation plan Decision 13 (issue #10): the device-wide single-read lock. Spec Business
 * Rule 22, AC28.
 */

describe('sync-lock (Decision 13, AC28)', () => {
  beforeEach(() => {
    __resetReadLockForTests();
  });

  it('is not in progress initially', () => {
    expect(isReadInProgress()).toBe(false);
  });

  it('acquiring the lock for a free device succeeds and marks a read in progress', () => {
    const release = acquireReadLock('connection-1');
    expect(release).not.toBeNull();
    expect(isReadInProgress()).toBe(true);
  });

  it('a second request for the *same* connection while the lock is held is refused (AC28)', () => {
    const first = acquireReadLock('connection-1');
    expect(first).not.toBeNull();

    const second = acquireReadLock('connection-1');
    expect(second).toBeNull();
  });

  it('a request for a *different* connection while the lock is held is also refused (AC28, second sentence)', () => {
    const first = acquireReadLock('connection-1');
    expect(first).not.toBeNull();

    const second = acquireReadLock('connection-2');
    expect(second).toBeNull();
  });

  it('releasing frees the lock for the same or a different connection', () => {
    const release = acquireReadLock('connection-1');
    expect(release).not.toBeNull();
    release?.();
    expect(isReadInProgress()).toBe(false);

    const next = acquireReadLock('connection-2');
    expect(next).not.toBeNull();
  });

  it('releasing twice is safe (idempotent) and never frees a lock a later acquire now holds', () => {
    const releaseFirst = acquireReadLock('connection-1');
    expect(releaseFirst).not.toBeNull();
    releaseFirst?.();

    const releaseSecond = acquireReadLock('connection-2');
    expect(releaseSecond).not.toBeNull();

    // A stale release handle from the first (already-released) acquisition must not free the
    // second, currently-held lock.
    releaseFirst?.();
    expect(isReadInProgress()).toBe(true);

    releaseSecond?.();
    expect(isReadInProgress()).toBe(false);
  });

  it('the test-and-set is atomic across two overlapping, un-awaited acquisitions — exactly one succeeds', () => {
    // No `await` between these two calls: proves there is no window in which both could read
    // `activeConnectionId === null` before either writes to it (JavaScript's single-threaded
    // event loop makes this true by construction, but this test pins the observable behaviour).
    const first = acquireReadLock('connection-1');
    const second = acquireReadLock('connection-1');

    const successes = [first, second].filter((release) => release !== null);
    expect(successes).toHaveLength(1);
  });
});
