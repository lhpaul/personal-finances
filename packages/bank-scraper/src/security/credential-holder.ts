/**
 * The single owner of the plaintext credentials, for exactly the duration of one read (spec
 * Business Rules 1-4, 6; implementation plan Decision 5).
 *
 * `#fields` is a true private field, unreachable from outside the class — including via
 * `Object.keys` or a spread — so nothing but `consume()` can read the values. `clear()` cannot
 * overwrite the bytes of the JavaScript strings the caller passed in (strings are immutable);
 * what it guarantees, and what is tested, is that every reference is dropped, so the strings
 * become unreachable and GC-eligible, and every subsequent `consume()` throws
 * `CredentialsClearedError`.
 */

export class CredentialsClearedError extends Error {
  constructor() {
    super('CredentialHolder: credentials have already been cleared');
    this.name = 'CredentialsClearedError';
  }
}

export class CredentialHolder {
  #fields: Record<string, string> | null;

  constructor(fields: Readonly<Record<string, string>>) {
    this.#fields = { ...fields };
  }

  /**
   * The only way to read a value out of the holder. Throws `CredentialsClearedError` once
   * `clear()` has run — there is no way to consume a cleared holder.
   */
  consume<T>(fn: (fields: Readonly<Record<string, string>>) => T): T {
    if (this.#fields === null) {
      throw new CredentialsClearedError();
    }
    // A frozen shallow copy, not `this.#fields` itself (CodeRabbit finding #31): the `Readonly<>`
    // type is erased at runtime, so without this, a callback could mutate the holder's internal
    // object or retain the reference beyond the call — enforced at runtime, not by convention.
    return fn(Object.freeze({ ...this.#fields }));
  }

  /** Idempotent. Drops every reference to the plaintext values. */
  clear(): void {
    if (this.#fields !== null) {
      for (const key of Object.keys(this.#fields)) {
        this.#fields[key] = '';
      }
      this.#fields = null;
    }
  }

  isCleared(): boolean {
    return this.#fields === null;
  }
}
