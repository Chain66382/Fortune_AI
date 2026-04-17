#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-fortune}"
APP_GROUP="${APP_GROUP:-fortune}"
APP_HOME="${APP_HOME:-/opt/fortune-ai}"
APP_DIR="${APP_DIR:-$APP_HOME/app}"
ENV_DIR="${ENV_DIR:-/etc/fortune-ai}"
SERVICE_NAME="${SERVICE_NAME:-fortune-ai}"
NODE_MAJOR="${NODE_MAJOR:-22}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run this script with sudo."
  exit 1
fi

apt-get update
apt-get install -y curl git nginx build-essential

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "${APP_HOME}" --shell /bin/bash "${APP_USER}"
fi

mkdir -p "${APP_DIR}" "${ENV_DIR}" "${APP_HOME}/shared/data/runtime" "${APP_HOME}/shared/uploads"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_HOME}" "${ENV_DIR}"

cp deploy/oracle/systemd/fortune-ai.service "/etc/systemd/system/${SERVICE_NAME}.service"
cp deploy/oracle/nginx/fortune-ai.conf /etc/nginx/sites-available/fortune-ai.conf

ln -sf /etc/nginx/sites-available/fortune-ai.conf /etc/nginx/sites-enabled/fortune-ai.conf
rm -f /etc/nginx/sites-enabled/default

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
nginx -t
systemctl restart nginx

echo "Bootstrap complete."
echo "1. Copy deploy/oracle/fortune-ai.env.example to ${ENV_DIR}/fortune-ai.env and fill in secrets."
echo "2. Clone the repo into ${APP_DIR} as ${APP_USER}."
echo "3. Run npm ci && npm run build."
echo "4. Start the service: systemctl start ${SERVICE_NAME}"
