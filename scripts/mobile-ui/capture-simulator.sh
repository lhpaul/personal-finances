#!/usr/bin/env bash
# Captures a screenshot of the running app from the fidelity iOS simulator (implementation plan
# Decision 5, Decision 6, Decision 7, Layer-by-Layer § `capture-simulator.sh`).
#
# Resolution order: booted device matching `simulator_name` ("Finanzas Fidelity") first, then a
# booted device matching the profile's `device_types`. If neither is found, prints the exact
# `xcrun simctl create` command instead of capturing the wrong device.
#
# Usage:
#   bash scripts/mobile-ui/capture-simulator.sh --profile iphone-393x852 --check-only
#   bash scripts/mobile-ui/capture-simulator.sh --profile iphone-393x852 --deep-link <url> --output <path>
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROFILE=""
OUTPUT=""
DEEP_LINK=""
SETTLE_MS=""
CHECK_ONLY="false"
SIMULATOR_NAME=""
PROFILE_WIDTH=""
PROFILE_HEIGHT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      [[ $# -ge 2 && -n "${2:-}" ]] || { echo "Error: --profile requires a value" >&2; exit 1; }
      PROFILE="$2"
      shift 2
      ;;
    --output)
      [[ $# -ge 2 && -n "${2:-}" ]] || { echo "Error: --output requires a path" >&2; exit 1; }
      OUTPUT="$2"
      shift 2
      ;;
    --deep-link)
      [[ $# -ge 2 && -n "${2:-}" ]] || { echo "Error: --deep-link requires a value" >&2; exit 1; }
      DEEP_LINK="$2"
      shift 2
      ;;
    --settle-ms)
      [[ $# -ge 2 && -n "${2:-}" ]] || { echo "Error: --settle-ms requires a value" >&2; exit 1; }
      SETTLE_MS="$2"
      shift 2
      ;;
    --check-only)
      CHECK_ONLY="true"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 --profile <id> [--check-only] [--deep-link <url>] [--output <path>] [--settle-ms <n>]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

: "${PROFILE:?--profile is required}"

# Read the profile's dimensions, simulator_name, device_types and settle_ms default from the
# fidelity contract, so this script never hand-duplicates them (Decision 4/5).
PROFILE_JSON="$(node -e "
import('${REPO_ROOT}/scripts/mobile-ui/fidelity-contract.mjs').then((m) => {
  const v = m.validateFidelityContract({});
  const profile = v.contract.profiles[process.argv[1]];
  if (!profile) { console.error('unknown profile'); process.exit(1); }
  console.log(JSON.stringify({
    width: profile.width,
    height: profile.height,
    simulatorName: profile.simulator_name,
    deviceTypes: profile.device_types ?? [],
    settleMs: v.contract.defaults.settle_ms,
  }));
});
" "$PROFILE")" || { echo "Error: unknown fidelity profile '$PROFILE'" >&2; exit 1; }

PROFILE_WIDTH="$(node -e "console.log(JSON.parse(process.argv[1]).width)" "$PROFILE_JSON")"
PROFILE_HEIGHT="$(node -e "console.log(JSON.parse(process.argv[1]).height)" "$PROFILE_JSON")"
SIMULATOR_NAME="$(node -e "console.log(JSON.parse(process.argv[1]).simulatorName)" "$PROFILE_JSON")"
DEVICE_TYPES_CSV="$(node -e "console.log(JSON.parse(process.argv[1]).deviceTypes.join('|'))" "$PROFILE_JSON")"
if [[ -z "$SETTLE_MS" ]]; then
  SETTLE_MS="$(node -e "console.log(JSON.parse(process.argv[1]).settleMs)" "$PROFILE_JSON")"
fi

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="${REPO_ROOT}/.tmp/ui-fidelity/app-screenshot.png"
fi
if [[ "$OUTPUT" != /* ]]; then
  OUTPUT="${REPO_ROOT}/${OUTPUT}"
fi
mkdir -p "$(dirname "$OUTPUT")"

find_udid_by_name() {
  xcrun simctl list devices booted | awk -v pattern="$1" 'index($0, pattern) { if (match($0, /\([0-9A-F-]+\)/)) { print substr($0, RSTART + 1, RLENGTH - 2); exit } }'
}

print_create_hint() {
  local runtime
  runtime="$(xcrun simctl list runtimes 2>/dev/null | awk '/iOS/ {print $NF}' | tail -1)"
  echo "Error: no booted simulator matches profile '$PROFILE' (simulator_name '$SIMULATOR_NAME', device types: $DEVICE_TYPES_CSV)" >&2
  echo "Create and boot it with:" >&2
  echo "  xcrun simctl create \"$SIMULATOR_NAME\" \"<one of: $DEVICE_TYPES_CSV>\" \"${runtime:-<runtime id>}\"" >&2
  echo "  xcrun simctl boot \"$SIMULATOR_NAME\"" >&2
}

SIMULATOR_ID="$(find_udid_by_name "$SIMULATOR_NAME" || true)"
if [[ -z "$SIMULATOR_ID" ]]; then
  IFS='|' read -r -a device_types <<<"$DEVICE_TYPES_CSV"
  for device_type in "${device_types[@]}"; do
    candidate="$(find_udid_by_name "$device_type" || true)"
    if [[ -n "$candidate" ]]; then
      SIMULATOR_ID="$candidate"
      break
    fi
  done
fi

if [[ -z "$SIMULATOR_ID" ]]; then
  print_create_hint
  exit 1
fi

if [[ "$CHECK_ONLY" == "true" ]]; then
  echo "Booted simulator matches profile '$PROFILE': $SIMULATOR_ID"
  exit 0
fi

if [[ -n "$DEEP_LINK" ]]; then
  xcrun simctl openurl "$SIMULATOR_ID" "$DEEP_LINK"
fi

# Decision 7: a settle floor, then poll every 500ms for two consecutive identical frames, up to
# a 20s ceiling. A fixed sleep either flakes on a cold Metro bundle or wastes time on every
# target; the floor prevents locking onto a static splash screen.
sleep "$(node -e "console.log(Number(process.argv[1]) / 1000)" "$SETTLE_MS")"

TMP_A="$(mktemp -t fidelity-poll-a).png"
TMP_B="$(mktemp -t fidelity-poll-b).png"
trap 'rm -f "$TMP_A" "$TMP_B"' EXIT

STABLE="false"
DEADLINE=$(($(date +%s) + 20))
xcrun simctl io "$SIMULATOR_ID" screenshot "$TMP_A" >/dev/null
while [[ "$(date +%s)" -lt "$DEADLINE" ]]; do
  sleep 0.5
  xcrun simctl io "$SIMULATOR_ID" screenshot "$TMP_B" >/dev/null
  if cmp -s "$TMP_A" "$TMP_B"; then
    STABLE="true"
    break
  fi
  cp "$TMP_B" "$TMP_A"
done

if [[ "$STABLE" != "true" ]]; then
  echo "Error: screenshot did not stabilise within 20s (still mid-transition or bundling)" >&2
  exit 1
fi

cp "$TMP_B" "$OUTPUT"

if command -v sips >/dev/null 2>&1; then
  width="$(sips -g pixelWidth "$OUTPUT" 2>/dev/null | awk '/pixelWidth/ {print $2}')"
  height="$(sips -g pixelHeight "$OUTPUT" 2>/dev/null | awk '/pixelHeight/ {print $2}')"
  if [[ -n "${width:-}" && "$width" -gt "$PROFILE_WIDTH" ]]; then
    sips --resampleWidth "$PROFILE_WIDTH" "$OUTPUT" >/dev/null
    height="$(sips -g pixelHeight "$OUTPUT" 2>/dev/null | awk '/pixelHeight/ {print $2}')"
  fi
  if [[ -n "${height:-}" ]]; then
    deviation="$(node -e "console.log(Math.abs(Number(process.argv[1]) - Number(process.argv[2])) / Number(process.argv[2]) * 100)" "$height" "$PROFILE_HEIGHT")"
    within_tolerance="$(node -e "console.log(Number(process.argv[1]) <= 2 ? 'true' : 'false')" "$deviation")"
    if [[ "$within_tolerance" != "true" ]]; then
      echo "Error: normalised capture height (${height}px) deviates from profile height (${PROFILE_HEIGHT}px) by more than 2% — wrong device, not resizing" >&2
      exit 1
    fi
  fi
fi

echo "Simulator screenshot saved ($PROFILE): $OUTPUT"
