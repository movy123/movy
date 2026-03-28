#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <deploy-dir>"
  exit 1
fi

DEPLOY_DIR="$1"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1"
    exit 1
  fi
}

require_command docker

if docker compose version >/dev/null 2>&1; then
  :
else
  echo "docker compose plugin is required on the staging host"
  exit 1
fi

mkdir -p "${DEPLOY_DIR}/infra"
mkdir -p "${DEPLOY_DIR}/releases"

echo "staging host bootstrap complete"
echo "deploy dir: ${DEPLOY_DIR}"
echo "next steps:"
echo "1. copy infra/docker-compose.staging.yml into ${DEPLOY_DIR}/infra"
echo "2. provide ${DEPLOY_DIR}/.env.staging via workflow or secure host provisioning"
echo "3. run deploy-staging workflow from GitHub Actions"
