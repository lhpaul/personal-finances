import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * Proves `no-restricted-imports` (`sharedDomainPurity` in the root `eslint.config.mjs`) actually
 * rejects a deliberate violation from `@finanzas/shared-domain` — the item #1 acceptance criterion
 * (AC7) that was previously only exercised by a manual runbook step (implementation plan for #35,
 * Decision 5).
 *
 * Drives the real ESLint CLI over stdin instead of importing the ESLint Node API, because
 * `packages/shared-domain/eslint.config.mjs` is an ES module that ESLint loads with a dynamic
 * `import()`; doing that inside Jest's CommonJS module registry is a known source of
 * environment-dependent failures. A child process runs the exact code path a developer runs, with
 * config resolution from `cwd`, and cannot be fooled by Jest's loader.
 *
 * Nothing is written to the working tree: each probe is piped to ESLint over stdin, so a
 * violating fixture never has to be committed (and therefore never has to be ignored from
 * `pnpm lint`, which would itself be one more declared-but-unverified control).
 */

jest.setTimeout(60_000);

const packageRoot = path.resolve(__dirname, '..');
const sharedUtilsRoot = path.resolve(packageRoot, '..', 'shared-utils');

// ESLint's `exports` map does not expose `bin/eslint.js` directly, so it is located relative to
// the resolved package.json instead of a bare `require.resolve('eslint/bin/eslint.js')`.
const eslintBin = path.join(path.dirname(require.resolve('eslint/package.json')), 'bin', 'eslint.js');

const STDIN_FILENAME = 'src/purity-probe.ts';

/** The exact message `sharedDomainPurity` attaches to a restricted import (V13). */
const SHARED_DOMAIN_MESSAGE =
  '@finanzas/shared-domain may not depend on the app, on Expo modules, or on any SQL library.';

interface EslintMessage {
  ruleId: string | null;
  message: string;
}

interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
  errorCount: number;
}

function runEslintOnStdin(source: string, cwd: string): { messages: EslintMessage[]; result: SpawnSyncReturns<string> } {
  const result = spawnSync(
    process.execPath,
    [eslintBin, '--no-color', '--format', 'json', '--stdin', '--stdin-filename', STDIN_FILENAME],
    // `timeout`/`killSignal` bound the child process: `jest.setTimeout(60_000)` cannot interrupt a
    // blocked synchronous spawnSync call, so an ESLint hang would otherwise wedge the whole worker.
    { cwd, input: source, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL' },
  );

  if (result.error) {
    throw new Error(`Failed to spawn ESLint CLI: ${result.error.message}`);
  }

  // ESLint's stdout is empty (not even `[]`) when a fatal, non-lint error occurs (e.g. a config
  // load failure); surface stderr in that case instead of failing on JSON.parse with no context.
  if (!result.stdout.trim()) {
    throw new Error(
      `ESLint CLI produced no stdout (exit ${String(result.status)}). stderr:\n${result.stderr}`,
    );
  }

  const parsed = JSON.parse(result.stdout) as EslintResult[];
  // `--stdin` always lints exactly one virtual file.
  return { messages: parsed[0]?.messages ?? [], result };
}

describe('@finanzas/shared-domain purity rule (no-restricted-imports)', () => {
  it('fires on a deliberate violation of every restricted category (AC7)', () => {
    const probe = [
      "import 'expo-sqlite';",
      "import 'drizzle-orm';",
      "import 'react-native';",
      "import '../../apps/mobile/src/theme';",
      '',
    ].join('\n');

    const { messages, result } = runEslintOnStdin(probe, packageRoot);

    expect(result.status).toBe(1);
    expect(messages).toHaveLength(4);
    for (const message of messages) {
      expect(message.ruleId).toBe('no-restricted-imports');
      expect(message.message).toContain(SHARED_DOMAIN_MESSAGE);
    }
  });

  it('does not over-fire on imports the rule does not restrict (negative control)', () => {
    const probe = ["import '@finanzas/shared-utils';", "import 'node:assert';", ''].join('\n');

    const { messages, result } = runEslintOnStdin(probe, packageRoot);

    expect(result.status).toBe(0);
    expect(messages).toHaveLength(0);
  });

  it('is scoped by packages/shared-domain/eslint.config.mjs and does not leak repo-wide', () => {
    const probe = [
      "import 'expo-sqlite';",
      "import 'drizzle-orm';",
      "import 'react-native';",
      "import '../../apps/mobile/src/theme';",
      '',
    ].join('\n');

    // Same violating probe, run with cwd set to a sibling package that applies its own, differently
    // worded purity rule (sharedUtilsPurity). Proves the shared-domain message is reached through
    // packages/shared-domain/eslint.config.mjs's real config chain, not hard-coded or leaking into
    // every package (V14).
    const { messages, result } = runEslintOnStdin(probe, sharedUtilsRoot);

    // Assert the sibling rule actually ran and fired (not just "no shared-domain message"): a
    // missing or bypassed packages/shared-utils/eslint.config.mjs would silently produce the same
    // "absent" result this test is checking for, which would defeat its own purpose.
    expect(result.status).toBe(1);
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(message.ruleId).toBe('no-restricted-imports');
      expect(message.message).not.toContain(SHARED_DOMAIN_MESSAGE);
    }
  });
});
