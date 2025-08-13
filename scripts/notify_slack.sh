#!/usr/bin/env bash
set -euo pipefail

MSG=${1:-"No message provided"}

if [ -z "${SLACK_WEBHOOK_URL:-}" ]; then
  echo "SLACK_WEBHOOK_URL not set" >&2
  exit 1
fi

curl -fsSL -X POST -H 'Content-type: application/json' --data "{\"text\": \"${MSG//"/\"}\"}" "$SLACK_WEBHOOK_URL"