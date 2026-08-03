#!/usr/bin/env bash
# Gate self-verification (implementation plan Decision 10, "Gate self-verification: proving
# both directions"). Runs four mockup-only comparisons against `home--pending` and asserts exit
# codes:
#
#   V1 faithful build   — two independent browser launches of the same mock, expect PASS/exit 0
#   V2 wrong design token — a `--brand`/`--tab-active`/`--t-brand`/`--grad-challenge` override, expect FAIL/exit 1
#   V3 wrong / missing state — `home--pending` vs `home--all-clear`, expect FAIL/exit 1
#   V4 wrong device size — 393x852 vs the same capture distorted to 375x667, expect FAIL/exit 1
#
# This needs no simulator and no running app; it proves the *comparator* discriminates. It does
# not prove the device capture path — that is the smoke runbook's V5.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT_DIR="${REPO_ROOT}/.tmp/ui-fidelity"
REPORT="${OUTPUT_DIR}/gate-verification.md"
PROFILE="iphone-393x852"

mkdir -p "$OUTPUT_DIR"

# Fail fast: V4 needs `sips` to distort the app capture. Checking here, before any Playwright
# capture runs, avoids wasting several browser launches only to abort on the V4 step.
if ! command -v sips >/dev/null 2>&1; then
  echo "Error: 'sips' is required for V4 (wrong device size) and was not found on PATH" >&2
  exit 1
fi

# Read home--pending's actual contract threshold and the shared pixel threshold, so this proof
# uses the same numbers the real gate would (Decision 4) rather than the comparator's defaults.
THRESHOLDS_JSON="$(node -e "
import('${REPO_ROOT}/scripts/mobile-ui/fidelity-contract.mjs').then((m) => {
  const v = m.validateFidelityContract({});
  const mapping = v.mappings.get('home--pending');
  const max = mapping.max_mismatch_pct ?? v.contract.defaults.max_mismatch_pct;
  const pixel = v.contract.defaults.pixel_threshold;
  console.log(JSON.stringify({ max, pixel }));
});
")" || { echo "Error: failed to read home--pending threshold from the fidelity contract" >&2; exit 1; }
MAX_MISMATCH_PCT="$(node -e "console.log(JSON.parse(process.argv[1]).max)" "$THRESHOLDS_JSON")"
PIXEL_THRESHOLD="$(node -e "console.log(JSON.parse(process.argv[1]).pixel)" "$THRESHOLDS_JSON")"
if [[ -z "$MAX_MISMATCH_PCT" || -z "$PIXEL_THRESHOLD" ]]; then
  echo "Error: could not resolve home--pending thresholds from the fidelity contract" >&2
  exit 1
fi

capture_mock() {
  local output="$1"
  local override_css="${2:-}"
  local args=(scripts/mobile-ui/capture-mockup.mjs --screen home --state pending --profile "$PROFILE" --output "$output")
  if [[ -n "$override_css" ]]; then
    args+=(--override-css "$override_css")
  fi
  node "${args[@]}"
}

capture_state() {
  local state="$1"
  local output="$2"
  node scripts/mobile-ui/capture-mockup.mjs --screen home --state "$state" --profile "$PROFILE" --output "$output"
}

run_compare() {
  local target="$1"
  local mock="$2"
  local app="$3"
  local diff="$4"
  local report="$5"
  local exit_code=0
  node scripts/mobile-ui/compare-screenshots.mjs \
    --mock "$mock" \
    --app "$app" \
    --diff "$diff" \
    --report "$report" \
    --target "$target" \
    --profile "$PROFILE" \
    --max-mismatch-pct "$MAX_MISMATCH_PCT" \
    --pixel-threshold "$PIXEL_THRESHOLD" \
    >"${report}.stdout" 2>&1 || exit_code=$?
  echo "$exit_code"
}

pct_from_stdout() {
  # Extracts the "NN.NN%" mismatch figure from compare-screenshots.mjs's PASS/FAIL line.
  # `-m 1` (not `| head -1`) so the first grep exits cleanly on its own instead of being cut off
  # by a downstream consumer, which under `pipefail` can otherwise surface a spurious SIGPIPE
  # (exit 141) as a pipeline failure even though a match was found.
  grep -m 1 -oE '[0-9]+\.[0-9]+% vs' "$1" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' || echo "n/a"
}

echo "== V1: faithful build (two independent browser launches) =="
capture_mock "${OUTPUT_DIR}/gate-v1-a.png"
capture_mock "${OUTPUT_DIR}/gate-v1-b.png"
V1_EXIT="$(run_compare "gate-v1" "${OUTPUT_DIR}/gate-v1-a.png" "${OUTPUT_DIR}/gate-v1-b.png" "${OUTPUT_DIR}/gate-v1-diff.png" "${OUTPUT_DIR}/gate-v1-report.md")"
V1_PCT="$(pct_from_stdout "${OUTPUT_DIR}/gate-v1-report.md.stdout")"

echo "== V2: wrong design token (--brand/--tab-active/--t-brand/--grad-challenge forced to #ef4444) =="
capture_mock "${OUTPUT_DIR}/gate-v2-mock.png"
capture_mock "${OUTPUT_DIR}/gate-v2-app.png" ":root{--brand:#ef4444;--tab-active:#ef4444;--t-brand:#ef4444;--grad-challenge:#ef4444}"
V2_EXIT="$(run_compare "gate-v2" "${OUTPUT_DIR}/gate-v2-mock.png" "${OUTPUT_DIR}/gate-v2-app.png" "${OUTPUT_DIR}/gate-v2-diff.png" "${OUTPUT_DIR}/gate-v2-report.md")"
V2_PCT="$(pct_from_stdout "${OUTPUT_DIR}/gate-v2-report.md.stdout")"

echo "== V3: wrong / missing state (home--pending vs home--all-clear) =="
capture_mock "${OUTPUT_DIR}/gate-v3-mock.png"
capture_state "all-clear" "${OUTPUT_DIR}/gate-v3-app.png"
V3_EXIT="$(run_compare "gate-v3" "${OUTPUT_DIR}/gate-v3-mock.png" "${OUTPUT_DIR}/gate-v3-app.png" "${OUTPUT_DIR}/gate-v3-diff.png" "${OUTPUT_DIR}/gate-v3-report.md")"
V3_PCT="$(pct_from_stdout "${OUTPUT_DIR}/gate-v3-report.md.stdout")"

echo "== V4: wrong device size (393x852 vs the same capture distorted to 375x667) =="
capture_mock "${OUTPUT_DIR}/gate-v4-mock.png"
cp "${OUTPUT_DIR}/gate-v4-mock.png" "${OUTPUT_DIR}/gate-v4-app.png"
sips -z 667 375 "${OUTPUT_DIR}/gate-v4-app.png" >/dev/null
V4_EXIT="$(run_compare "gate-v4" "${OUTPUT_DIR}/gate-v4-mock.png" "${OUTPUT_DIR}/gate-v4-app.png" "${OUTPUT_DIR}/gate-v4-diff.png" "${OUTPUT_DIR}/gate-v4-report.md")"
V4_ASPECT_NOTE="not checked"
if grep -q "Aspect ratio" "${OUTPUT_DIR}/gate-v4-report.md" 2>/dev/null; then
  V4_ASPECT_NOTE="reported"
fi

FAILURES=()
[[ "$V1_EXIT" == "0" ]] || FAILURES+=("V1 expected exit 0, got ${V1_EXIT}")
[[ "$V2_EXIT" == "1" ]] || FAILURES+=("V2 expected exit 1, got ${V2_EXIT}")
[[ "$V3_EXIT" == "1" ]] || FAILURES+=("V3 expected exit 1, got ${V3_EXIT}")
[[ "$V4_EXIT" == "1" ]] || FAILURES+=("V4 expected exit 1, got ${V4_EXIT}")
[[ "$V4_ASPECT_NOTE" == "reported" ]] || FAILURES+=("V4 report did not record an aspect-ratio mismatch")

{
  echo "# Fidelity gate self-verification"
  echo
  echo "Profile: \`${PROFILE}\` · Threshold: ${MAX_MISMATCH_PCT}% (home--pending, from the fidelity contract) · Pixel threshold: ${PIXEL_THRESHOLD}"
  echo
  echo "| Case | Inputs | Mismatch | Exit code | Expected | Result |"
  echo "| --- | --- | --- | --- | --- | --- |"
  echo "| V1 faithful build | \`home--pending\` captured twice, two browser launches | ${V1_PCT}% | ${V1_EXIT} | 0 (PASS) | $([[ "$V1_EXIT" == "0" ]] && echo OK || echo MISMATCH) |"
  echo "| V2 wrong design token | clean vs \`--brand\`/\`--tab-active\`/\`--t-brand\`/\`--grad-challenge\` forced to \`#ef4444\` | ${V2_PCT}% | ${V2_EXIT} | 1 (FAIL) | $([[ "$V2_EXIT" == "1" ]] && echo OK || echo MISMATCH) |"
  echo "| V3 wrong / missing state | \`home--pending\` vs \`home--all-clear\` | ${V3_PCT}% | ${V3_EXIT} | 1 (FAIL) | $([[ "$V3_EXIT" == "1" ]] && echo OK || echo MISMATCH) |"
  echo "| V4 wrong device size | 393×852 vs the same capture resampled to 375×667 | 100.00% (aspect mismatch) | ${V4_EXIT} | 1 (FAIL) | $([[ "$V4_EXIT" == "1" && "$V4_ASPECT_NOTE" == "reported" ]] && echo OK || echo MISMATCH) |"
  echo
  if [[ "${#FAILURES[@]}" -eq 0 ]]; then
    echo "**Gate self-verification PASSED**: both directions proved — the comparator passes on a"
    echo "faithful pair and fails on a wrong token, a wrong state, and a wrong device size."
  else
    echo "**Gate self-verification FAILED**:"
    for failure in "${FAILURES[@]}"; do
      echo "- ${failure}"
    done
  fi
} >"$REPORT"

cat "$REPORT"

if [[ "${#FAILURES[@]}" -gt 0 ]]; then
  exit 1
fi
exit 0
