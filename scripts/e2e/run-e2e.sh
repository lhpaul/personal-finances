#!/usr/bin/env bash
# Runs the Maestro E2E suite against the dedicated `Finanzas E2E` simulator (implementation plan
# for issue #22, D4, D16, D17). Checks Metro, the target device and the installed app before
# invoking `maestro test .maestro/` — a missing prerequisite fails with an actionable message
# instead of a mysterious `assertVisible` timeout (D3).
#
# Usage:
#   bash scripts/e2e/run-e2e.sh                                   # the whole suite
#   bash scripts/e2e/run-e2e.sh .maestro/flows/01-onboarding-connect.yaml   # a single flow
#   bash scripts/e2e/run-e2e.sh --allow-any-device                # skip the device-name guard
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_ID="cl.finanzas.mobile.dev"
SIMULATOR_NAME="Finanzas E2E"
DEVICE_TYPES=("iPhone 16" "iPhone 15" "iPhone 14")
MAESTRO_VERSION="${MAESTRO_VERSION:-2.6.0}"
METRO_URL="${METRO_URL:-http://localhost:8081/status}"
DEBUG_OUTPUT="${REPO_ROOT}/.tmp/e2e"
ALLOW_ANY_DEVICE="false"
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --allow-any-device)
      ALLOW_ANY_DEVICE="true"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--allow-any-device] [maestro test args, e.g. a single flow path]"
      exit 0
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

echo "== Maestro CLI =="
if ! command -v maestro >/dev/null 2>&1; then
  echo "Error: maestro CLI not found on PATH. Install the pinned version (${MAESTRO_VERSION}):" >&2
  echo "  curl -Ls \"https://get.maestro.mobile.dev\" | bash" >&2
  exit 1
fi
INSTALLED_VERSION="$(maestro --version 2>/dev/null | tr -d '[:space:]')"
if [[ -n "$INSTALLED_VERSION" && "$INSTALLED_VERSION" != "$MAESTRO_VERSION" ]]; then
  echo "Warning: installed Maestro CLI reports '${INSTALLED_VERSION}', pinned version is '${MAESTRO_VERSION}' (D16) — behaviour may differ from this runbook." >&2
fi

echo "== Metro =="
if ! curl -s --max-time 3 "$METRO_URL" 2>/dev/null | grep -q 'packager-status:running'; then
  echo "Error: Metro is not reachable at ${METRO_URL}. Start it first:" >&2
  echo "  pnpm dev:mobile" >&2
  exit 1
fi

echo "== Simulator (${SIMULATOR_NAME}) =="
find_udid_by_name() {
  # Exact device-name match, not substring — "iPhone 16" must not match a booted
  # "iPhone 16 Pro Max" (mirrors scripts/mobile-ui/capture-simulator.sh's own guard).
  xcrun simctl list devices booted | awk -v pattern="$1" '
    match($0, /\([0-9A-Fa-f-]+\)/) {
      name = substr($0, 1, RSTART - 1)
      gsub(/^[ \t]+|[ \t]+$/, "", name)
      if (name == pattern) {
        print substr($0, RSTART + 1, RLENGTH - 2)
        exit
      }
    }'
}

print_create_hint() {
  local runtime
  runtime="$(xcrun simctl list runtimes 2>/dev/null | awk '/iOS/ {print $NF}' | tail -1)"
  echo "Error: no booted simulator named '${SIMULATOR_NAME}' (D4) — this suite deletes secure-store credentials (D6/D7) and refuses to guess a substitute device." >&2
  echo "Create and boot it with:" >&2
  echo "  xcrun simctl create \"${SIMULATOR_NAME}\" \"<one of: ${DEVICE_TYPES[*]}>\" \"${runtime:-<runtime id>}\"" >&2
  echo "  xcrun simctl boot \"${SIMULATOR_NAME}\"" >&2
}

SIMULATOR_ID="$(find_udid_by_name "$SIMULATOR_NAME" || true)"
if [[ -z "$SIMULATOR_ID" ]]; then
  if [[ "$ALLOW_ANY_DEVICE" == "true" ]]; then
    echo "Warning: --allow-any-device set — falling back to any booted device matching ${DEVICE_TYPES[*]}. The reset fixture state will delete secure-store credentials on whichever device this resolves to (D7)." >&2
    for device_type in "${DEVICE_TYPES[@]}"; do
      candidate="$(find_udid_by_name "$device_type" || true)"
      if [[ -n "$candidate" ]]; then
        SIMULATOR_ID="$candidate"
        break
      fi
    done
  fi
fi

if [[ -z "$SIMULATOR_ID" ]]; then
  print_create_hint
  exit 1
fi
echo "Using simulator: ${SIMULATOR_ID}"

echo "== App installed =="
if ! xcrun simctl get_app_container "$SIMULATOR_ID" "$APP_ID" >/dev/null 2>&1; then
  echo "Error: ${APP_ID} is not installed on ${SIMULATOR_ID}. Build and install a Debug (__DEV__) build first (D3):" >&2
  echo "  npx expo run:ios --device \"${SIMULATOR_NAME}\"   (from apps/mobile)" >&2
  exit 1
fi

echo "== Running maestro test =="
mkdir -p "$DEBUG_OUTPUT"
if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
  # A specific flow (or set of flows) was requested — run exactly those, not the whole suite
  # (Implementation Order step 8: `bash scripts/e2e/run-e2e.sh .maestro/flows/<file>`).
  maestro test --debug-output "$DEBUG_OUTPUT" "${EXTRA_ARGS[@]}"
else
  maestro test "$REPO_ROOT/.maestro/" --debug-output "$DEBUG_OUTPUT"
fi
