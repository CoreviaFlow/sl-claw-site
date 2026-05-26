#!/usr/bin/env bash
# Альтернатива UI-шагу: создать оба сайта через Umami REST API и сразу получить UUIDs.
# Запускай ПОСЛЕ deploy.sh + смены пароля admin.
#
# Использование:
#   bash create-websites-via-api.sh <umami-host> <new-admin-password>
# Пример:
#   bash create-websites-via-api.sh https://umami.coreviaflow.space ВАШ_НОВЫЙ_ПАРОЛЬ

set -euo pipefail

UMAMI_HOST="${1:?Usage: $0 <umami-host> <admin-password>}"
ADMIN_PASS="${2:?Usage: $0 <umami-host> <admin-password>}"

log() { echo -e "\n\033[1;36m==> $*\033[0m"; }

# === Login ===
log "Logging in as admin..."
LOGIN_RESP=$(curl -fsS -X POST "${UMAMI_HOST}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"admin\",\"password\":\"${ADMIN_PASS}\"}")
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
[ -n "$TOKEN" ] || { echo "Не удалось получить token. Response: $LOGIN_RESP"; exit 1; }
log "✅ token получен"

# === Создать сайт 1: sl-claw.tech ===
log "Creating website: sl-claw.tech..."
SL_CLAW_RESP=$(curl -fsS -X POST "${UMAMI_HOST}/api/websites" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"name":"sl-claw.tech","domain":"sl-claw.tech"}')
SL_CLAW_ID=$(echo "$SL_CLAW_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

# === Создать сайт 2: bulldozer.uno ===
log "Creating website: bulldozer.uno..."
BULL_RESP=$(curl -fsS -X POST "${UMAMI_HOST}/api/websites" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"name":"bulldozer.uno","domain":"bulldozer.uno"}')
BULL_ID=$(echo "$BULL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

# === Вывод ===
echo
echo "==============================================="
echo "Website IDs (отдай ассистенту чтобы заполнил в коде):"
echo "==============================================="
echo
echo "sl-claw.tech    : ${SL_CLAW_ID}"
echo "bulldozer.uno   : ${BULL_ID}"
echo
echo "Скопируй и пришли в чат:"
echo "  «SL: ${SL_CLAW_ID} | BULL: ${BULL_ID}»"
echo
