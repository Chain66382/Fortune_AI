#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${ORACLE_APP_DIR:-/opt/fortune-ai/app}"
SERVICE_NAME="${SERVICE_NAME:-fortune-ai}"
BRANCH_NAME="${BRANCH_NAME:-main}"
APP_GIT_SHA="${APP_GIT_SHA:-}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "Repository not found in ${APP_DIR}. Clone it on the server first."
  exit 1
fi

cd "${APP_DIR}"

git fetch origin "${BRANCH_NAME}"

if [[ -n "${APP_GIT_SHA}" ]]; then
  git checkout --force "${APP_GIT_SHA}"
else
  git checkout --force "origin/${BRANCH_NAME}"
fi

npm ci
npm run build

sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl status "${SERVICE_NAME}" --no-pager
