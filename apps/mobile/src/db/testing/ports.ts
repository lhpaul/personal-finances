import crypto from 'node:crypto';

import type { DbPorts } from '../ids';

/**
 * Deterministic test ports (implementation plan Decision 13). The runtime supplies
 * `expo-crypto`'s `digestStringAsync` and `randomUUID`; tests supply `node:crypto` and a
 * deterministic counter instead, which is also what makes the committed fixture
 * (`src/db/__fixtures__/store-v1.sql`, Step 8) reproducible byte-for-byte on every regeneration.
 */
export function createDeterministicPorts(options?: { startAt?: string }): DbPorts {
  let idCounter = 0;
  let clockMillis = new Date(options?.startAt ?? '2026-01-01T00:00:00.000Z').getTime();

  return {
    newId: () => {
      idCounter += 1;
      return `test-id-${String(idCounter).padStart(6, '0')}`;
    },
    now: () => {
      const iso = new Date(clockMillis).toISOString();
      clockMillis += 1000; // Each call advances by one second, so ordering-sensitive assertions
      // (e.g. "most recently seeded row") have a stable, reproducible answer.
      return iso;
    },
    digestSha256: (input: string) =>
      Promise.resolve(crypto.createHash('sha256').update(input, 'utf8').digest('hex')),
  };
}
