#!/usr/bin/env bash
# Repository checks: catalog <-> files, links, no placeholder text, no emoji. Prints OK on success.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "check: ${ROOT}"
python3 "${ROOT}/scripts/check.py"
