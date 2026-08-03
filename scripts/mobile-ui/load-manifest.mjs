#!/usr/bin/env node
/**
 * Loads `design/mockups/mobile/mockup-manifest.js` — a classic `<script>`-tag file, not JSON —
 * and exposes the canonical MVP screen/state universe the fidelity contract must cover exactly
 * once (implementation plan Decision 1, Layer-by-Layer § `load-manifest.mjs`).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const MANIFEST_PATH = 'design/mockups/mobile/mockup-manifest.js';

/**
 * Evaluates the manifest file in a sandboxed `node:vm` context (a bare `{ window: {} }` global,
 * a 2 s timeout) and returns `window.__MOCKUP_MANIFEST__`.
 */
export function loadManifest(root) {
  const file = path.join(root, MANIFEST_PATH);
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read manifest at "${MANIFEST_PATH}": ${error.message}`);
  }
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  try {
    new vm.Script(source, { filename: MANIFEST_PATH }).runInContext(sandbox, { timeout: 2000 });
  } catch (error) {
    throw new Error(`Failed to evaluate manifest "${MANIFEST_PATH}": ${error.message}`);
  }
  const manifest = sandbox.window.__MOCKUP_MANIFEST__;
  if (manifest == null || typeof manifest !== 'object') {
    throw new Error(`"${MANIFEST_PATH}" did not assign window.__MOCKUP_MANIFEST__`);
  }
  return manifest;
}

function findScreen(manifest, screenId) {
  return (manifest.screens ?? []).find((screen) => screen.screen_id === screenId);
}

export function assertScreenInManifest(manifest, screenId) {
  const screen = findScreen(manifest, screenId);
  if (!screen) {
    throw new Error(`Unknown screen_id "${screenId}" in the manifest`);
  }
  return screen;
}

export function assertStateInManifest(manifest, screenId, stateId) {
  const screen = assertScreenInManifest(manifest, screenId);
  const state = (screen.states ?? []).find((entry) => entry.state_id === stateId);
  if (!state) {
    const known = (screen.states ?? []).map((entry) => entry.state_id).join(', ') || '(none)';
    throw new Error(
      `Unknown state_id "${stateId}" for screen "${screenId}" in the manifest. Known states: ${known}`,
    );
  }
  return state;
}

/** The single `initial: true` state for a screen, or `null` for a stateless screen. */
export function initialStateForScreen(manifest, screenId) {
  const screen = assertScreenInManifest(manifest, screenId);
  const states = screen.states ?? [];
  if (states.length === 0) return null;
  const initial = states.filter((state) => state.initial === true);
  if (initial.length !== 1) {
    throw new Error(`Screen "${screenId}" must have exactly one initial state`);
  }
  return initial[0].state_id;
}

/**
 * The canonical `{ screenId, stateId }[]` universe the contract must cover exactly once
 * (Decision 1): every screen with `mvp !== false`, and — within it — every state with
 * `mvp !== false`. `stateId` is `null` for a stateless screen. A state itself flagged
 * `mvp: false` (today, only `categorize/advanced`) is excluded from this universe; the contract
 * may still record it as an `exclusions` entry for auditability (Decision 3), but the
 * completeness check does not require it.
 */
export function mvpTargets(manifest) {
  return (manifest.screens ?? [])
    .filter((screen) => screen.mvp !== false)
    .flatMap((screen) => {
      const states = (screen.states ?? []).filter((state) => state.mvp !== false);
      return states.length === 0
        ? [{ screenId: screen.screen_id, stateId: null }]
        : states.map((state) => ({ screenId: screen.screen_id, stateId: state.state_id }));
    });
}
