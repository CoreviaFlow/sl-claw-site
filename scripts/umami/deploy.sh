#!/usr/bin/env bash
# Umami self-hosted analytics deploy для corevia-vps.
# Запускай на самом VPS как root (или sudo).
#
# Использование:
#   scp -r scripts/umami root@corevia-vps:/tmp/umami-deploy/
#   ssh root@corevia-vps "cd /tmp/umami-deploy && bash deploy.sh"
#
# После успешного деплоя — DNS должен указывать на этот сервер для umami.coreviaflow.space.
# Затем: certbot --nginx -d umami.coreviaflow.space
# Затем: открыть https://umami.coreviaflow.space, логин admin/umami, сменить пароль.
# Затем: создать 2 сайта (sl-claw.tech, bulldozer.uno) — UUIDs идут в код.

set -euo pipefail

# === Конфиг (готов, не менять без причины) ===
APP_SECRET="e4f947e39fa0c8313fee1cb6dc5967fdfbf6c5edd66a196313ed9fb014a493d8"
DB_PASS="1ETgppyu4rwohjpxOHriYjMqxzaqSZ2"
DB_NAME="umami"
DB_USER="umami"
POSTGRES_CONTAINER="corevia-crm-pg17"
UMAMI_PORT="3033"  # internal (proxied через nginx)
DOMAIN="umami.coreviaflow.space"
INSTALL_DIR="/opt/umami"

# === Helpers ===
log() { echo -e "\n\033[1;36m==> $*\033[0m"; }
err() { echo -e "\033[1;31mERR: $*\033[0m" >&2; exit 1; }

# === Проверки ===
log "Checking prerequisites..."
[ "$(id -u)" -eq 0 ] || err "Запусти как root (sudo bash deploy.sh)"
command -v docker >/dev/null || err "docker не установлен"
command -v nginx >/dev/null || err "nginx не установлен"

docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$" \
    || err "Postgres-контейнер ${POSTGRES_CONTAINER} не запущен"

# === БД ===
log "Creating Postgres database '${DB_NAME}'..."
docker exec "${POSTGRES_CONTAINER}" psql -U postgres <<SQL || true
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
   END IF;
END
\$\$;
SELECT 'database ' || datname FROM pg_database WHERE datname = '${DB_NAME}';
SQL

# Создать БД если не существует
docker exec "${POSTGRES_CONTAINER}" psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
    || docker exec "${POSTGRES_CONTAINER}" psql -U postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

# === Docker compose ===
log "Setting up ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"

cat > "${INSTALL_DIR}/docker-compose.yml" <<COMPOSE
version: '3'
services:
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    container_name: umami
    restart: always
    ports:
      - "127.0.0.1:${UMAMI_PORT}:3000"
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASS}@host.docker.internal:5432/${DB_NAME}
      DATABASE_TYPE: postgresql
      APP_SECRET: ${APP_SECRET}
      DISABLE_TELEMETRY: 1
    extra_hosts:
      - "host.docker.internal:host-gateway"
COMPOSE

log "Pulling image + starting..."
cd "${INSTALL_DIR}"
docker compose pull
docker compose up -d

log "Waiting for Umami to come up..."
for i in {1..30}; do
    if curl -fsS "http://127.0.0.1:${UMAMI_PORT}/api/heartbeat" >/dev/null 2>&1; then
        log "Umami запустился (попытка ${i})"
        break
    fi
    sleep 2
    [ $i -eq 30 ] && err "Umami не поднялся за 60 секунд. Лог: docker logs umami --tail 50"
done

# === nginx vhost ===
log "Setting up nginx vhost..."
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"
if [ ! -f "$NGINX_CONF" ]; then
    cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${UMAMI_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # Umami script.js должен быть accessible с любого origin для tracking с sl-claw.tech / bulldozer.uno
        add_header Access-Control-Allow-Origin "*" always;
    }
}
NGINX
    ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
    nginx -t && systemctl reload nginx
    log "nginx vhost создан: $NGINX_CONF"
else
    log "nginx vhost уже существует, пропускаю"
fi

# === Итог ===
log "✅ Umami запущен!"
echo
echo "==============================================="
echo "Следующие шаги:"
echo "==============================================="
echo
echo "1) DNS A-запись: ${DOMAIN} → IP этого сервера (если ещё нет)"
echo "2) Дождись пропагации (минут 5-10)"
echo "3) Получи SSL:"
echo "   certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m admin@coreviaflow.space"
echo "4) Открой https://${DOMAIN}"
echo "   Логин: admin"
echo "   Пароль: umami  (СРАЗУ смени в Settings → Profile)"
echo "5) Создай 2 сайта в Umami:"
echo "   - Settings → Websites → Add website:"
echo "       Name: sl-claw.tech, Domain: sl-claw.tech"
echo "   - Settings → Websites → Add website:"
echo "       Name: bulldozer.uno, Domain: bulldozer.uno"
echo "6) Скопируй оба Website ID и отдай ассистенту — он заполнит в коде, пересоберёт и задеплоит."
echo
echo "Логи: docker logs umami -f"
echo "Перезапуск: cd ${INSTALL_DIR} && docker compose restart"
echo
