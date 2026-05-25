#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/stanton-hub}"
DB_NAME="${DB_NAME:-stanton_hub}"
DB_USER="${DB_USER:-stantonhub}"

echo "Preparando VPS para Stanton Hub..."

sudo apt update
sudo apt install -y curl git nginx mysql-server certbot python3-certbot-nginx

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
fi

sudo npm install -g pm2

sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER:$USER" "$APP_DIR"

echo
echo "Crea la base de datos con estos comandos dentro de MySQL como root:"
echo
echo "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_PASSWORD';"
echo "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
echo "FLUSH PRIVILEGES;"
echo
echo "Despues copia el proyecto en: $APP_DIR"
echo "Luego ejecuta: npm install && npm run build && pm2 start ecosystem.config.cjs && pm2 save"
