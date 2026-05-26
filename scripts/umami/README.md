# Umami deploy — turnkey package

Поставить self-hosted analytics на `umami.coreviaflow.space` за 2 команды.
Обслуживает `sl-claw.tech` + `bulldozer.uno` через единый instance.

## Что тут лежит

- `deploy.sh` — главный deploy на VPS (создаёт БД, поднимает Docker, ставит nginx vhost)
- `create-websites-via-api.sh` — создаёт оба сайта через Umami REST API и возвращает UUIDs (альтернатива UI)
- Секреты (APP_SECRET, DB password) уже зашиты в `deploy.sh` — сгенерированы локально через `openssl rand`

## Запуск (всё что нужно от пользователя)

### 1. На локальной машине — закинуть скрипты на VPS

```bash
cd "/Users/mac/Desktop/Разработки /AI Робот Продажник/shop"
scp -r scripts/umami root@corevia-vps:/tmp/umami-deploy/
```

### 2. На VPS — запустить deploy.sh

```bash
ssh root@corevia-vps
cd /tmp/umami-deploy
bash deploy.sh
```

Скрипт сам:
- Создаст БД `umami` в `corevia-crm-pg17`
- Создаст `/opt/umami/docker-compose.yml` со всеми секретами
- Поднимет контейнер Umami
- Создаст nginx vhost (HTTP)
- Подождёт пока поднимется
- Покажет следующие шаги

### 3. DNS + SSL

```bash
# В DNS-провайдере: A-запись umami.coreviaflow.space → IP сервера
# Подождать 5-10 минут пропагации.
# На сервере:
certbot --nginx -d umami.coreviaflow.space --non-interactive --agree-tos -m admin@coreviaflow.space
```

### 4. Сменить admin-пароль

Открой `https://umami.coreviaflow.space`. Логин `admin` / пароль `umami`.
Settings → Profile → Change password → задай новый.

### 5. Создать оба сайта (2 варианта)

**Вариант A (через UI):** Settings → Websites → Add website. Создай 2:
- Name `sl-claw.tech`, Domain `sl-claw.tech` → скопируй Website ID
- Name `bulldozer.uno`, Domain `bulldozer.uno` → скопируй Website ID

**Вариант B (через API, быстрее):**
```bash
bash /tmp/umami-deploy/create-websites-via-api.sh \
    https://umami.coreviaflow.space \
    ВАШ_НОВЫЙ_ПАРОЛЬ
```
Скрипт выведет оба UUID.

### 6. Отдать UUIDs ассистенту

Пришли в чат строку вида:
```
SL: e8a7b3c4-... | BULL: f2d4a1b9-...
```

Ассистент сам:
- Заполнит `UMAMI_WEBSITE_ID` в `shop/analytics.js`
- Заполнит `UMAMI_WEBSITE_ID` в `spectech-landing/build.py`
- Сделает `python3 build.py` + `./deploy.sh` для bulldozer.uno
- Сделает `git commit && git push` для sl-claw
- Прогонит smoke-тест что events приходят в Umami панель

## Структура итоговой инфраструктуры

```
sl-claw.tech (Coolify static)  ──┐
                                  ├──> umami.coreviaflow.space (host-nginx → docker)
bulldozer.uno (Coolify static) ──┘                              │
                                                                ▼
                                                       corevia-crm-pg17 (БД umami)
```

## Конфиг (зашит в deploy.sh)

- `APP_SECRET`: 64-symbol hex, сгенерирован 2026-05-26
- `DB_PASS`: 32-symbol base64-без-спецсимволов
- Postgres: shared с CRM-контейнером, отдельная БД `umami`
- Port: `127.0.0.1:3033` (только locally — nginx проксит)

## Бэкап и обслуживание

- БД попадает в существующий cron `pg_dump` (см. [[backups_corevia_vps]])
- Перезапуск: `cd /opt/umami && docker compose restart`
- Логи: `docker logs umami -f`
- Update: `cd /opt/umami && docker compose pull && docker compose up -d`

## Troubleshooting

| Симптом | Что проверять |
|---|---|
| `Umami не поднялся за 60 секунд` | `docker logs umami --tail 100`, проверь что DB-credentials правильно подключаются |
| `502 Bad Gateway` на домене | Umami не отвечает — `docker ps` и `docker logs umami` |
| SSL certbot fail | DNS ещё не пропагирован, `dig umami.coreviaflow.space` |
| Tracking не приходит | DevTools console → проверь что `umami.coreviaflow.space/script.js` загружается без ошибок. Проверь `data-website-id` корректный UUID. |
| CORS errors в browser | nginx vhost должен иметь `Access-Control-Allow-Origin "*"` (уже зашит в deploy.sh) |

## Связано

- Memory `umami_deploy.md` — основной runbook
- Memory `agent_teams_blueprint.md` — pm-analytics будет использовать Umami API
- Memory `shop_deploy_topology.md` — как живёт sl-claw.tech
