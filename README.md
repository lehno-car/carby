# AutoMarket Беларусь

Рабочий MVP маркетплейса автомобилей с пробегом в формате Telegram Mini App. Интерфейс — русский, страна фиксирована как Беларусь, поддерживаемые валюты — `BYN`, `RUB`, `USD` (по умолчанию `BYN`). Один Next.js-сервис обслуживает интерфейс, API и Telegram webhook; PostgreSQL и приватный Railway Storage Bucket подключаются как отдельные сервисы.

## Что реализовано

- Автоматическая Mini App-авторизация с серверной HMAC-SHA-256 проверкой `initData` и браузерный вход через одноразовую deep-link ссылку в Telegram-бота.
- Development-вход вне Telegram, физически отключённый при `NODE_ENV=production`.
- Лента с пагинацией, поиском, фильтрами и сортировками.
- Карточка автомобиля, галерея, частично скрытый VIN и связь по Telegram/телефону.
- Создание и редактирование объявления, статусы, перевод в «Продано», удаление.
- До 10 фото: проверка реального формата через Sharp, лимит 10 МБ, поворот/нормализация, WebP и thumbnail, изменение порядка и удаление.
- Приватное S3-совместимое хранение; клиент получает только короткоживущий signed URL через backend endpoint.
- Избранное, жалобы, профиль пользователя.
- Модерация по Telegram ID: очередь, одобрение/отклонение с обязательной причиной, аудит `ModerationEvent`, уведомление владельца.
- `/start`, Menu Button, защищённый secret token webhook и безопасный скрипт регистрации.
- Персистентный rate limit для авторизации, загрузки фото, создания объявлений и жалоб.
- Security headers, строгий TypeScript, ESLint, unit/smoke-тесты, seed, Docker и Railway config.

## Архитектура

```text
Telegram Mini App / browser
          │
          ▼
 Next.js 16 App Router
 ├─ React mobile UI
 ├─ Route Handlers /api/*
 ├─ Telegram auth + Bot webhook
 ├─ Drizzle domain/services
 └─ Sharp + AWS S3 SDK
        │          │
        ▼          ▼
 Railway       Railway private
 PostgreSQL    Storage Bucket
```

Основные каталоги:

```text
src/app/                 страницы и Route Handlers
src/components/          клиентские экраны и общие компоненты
src/server/auth/         Telegram initData и сессии
src/server/db/           Drizzle schema и подключение PostgreSQL
src/server/listings/     валидация, права и выборка объявлений
src/server/storage.ts    обработка изображений и S3
drizzle/                 версионируемые SQL-миграции
scripts/                 seed, production-migrate, webhook setup
```

## Локальный запуск

Нужны Node.js 20.9+ (рекомендуется 24), Corepack, Docker и Docker Compose.

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

На Windows вместо `cp`:

```powershell
Copy-Item .env.example .env
```

Откройте `http://localhost:3000`. Для входа вне Telegram оставьте `DEV_AUTH_ENABLED=true`, затем нажмите «Тестовый вход» в профиле. Этот маршрут всегда возвращает 404 в production.

Локальная PostgreSQL из `compose.yaml` использует URL:

```text
postgresql://postgres:postgres@localhost:5432/automarket
```

Миграции генерируются командой `pnpm db:generate`, применяются только вперёд безопасной командой `pnpm db:migrate`. Railway перед каждым deploy автоматически применяет миграции и проверяет Telegram webhook. Не используйте `drizzle-kit push` в production.

## Переменные окружения

| Переменная                | Назначение                                                        |
| ------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`            | PostgreSQL connection string                                      |
| `APP_URL`                 | Публичный HTTPS URL приложения без завершающего `/`               |
| `TELEGRAM_BOT_TOKEN`      | Токен BotFather; только сервер                                    |
| `TELEGRAM_BOT_USERNAME`   | Username бота без `@`                                             |
| `TELEGRAM_WEBAPP_URL`     | HTTPS URL Mini App                                                |
| `TELEGRAM_ADMIN_IDS`      | Telegram ID администраторов через запятую                         |
| `TELEGRAM_WEBHOOK_SECRET` | 16+ символов `A-Z a-z 0-9 _ -` для webhook header                 |
| `SESSION_SECRET`          | Случайная строка не короче 32 символов                            |
| `BUCKET`                  | Реальное S3 API имя Railway Bucket                                |
| `ACCESS_KEY_ID`           | Ключ Railway Bucket                                               |
| `SECRET_ACCESS_KEY`       | Секрет Railway Bucket                                             |
| `ENDPOINT`                | Например `https://storage.railway.app`                            |
| `REGION`                  | Обычно `auto`                                                     |
| `S3_URL_STYLE`            | `virtual` для новых bucket, `path` если так указано в Credentials |
| `DEV_AUTH_ENABLED`        | `true` только локально; в production игнорируется                 |

Сгенерировать секреты можно отдельно для каждой переменной:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env*` исключены из Git, кроме безопасного `.env.example`.

## Telegram BotFather и Mini App

1. Откройте `@BotFather`, выполните `/newbot`, сохраните token в `TELEGRAM_BOT_TOKEN`.
2. В `/mybots` → ваш бот → **Bot Settings** → **Configure Mini App** включите Mini App и укажите `TELEGRAM_WEBAPP_URL`.
3. После первого Railway deploy задайте `APP_URL` и `TELEGRAM_WEBAPP_URL` равными выданному HTTPS-домену.
4. Для ручной повторной проверки можно запустить локально с production-переменными:

   ```bash
   pnpm telegram:webhook
   ```

   Этот же скрипт автоматически запускается при Railway deploy. Он проверяет, что token принадлежит указанному username, регистрирует `https://<APP_URL>/api/telegram/webhook` с `secret_token` и настраивает Menu Button.

5. Отправьте боту `/start`: он ответит кнопкой открытия Mini App.

Backend доверяет только сырому `Telegram.WebApp.initData` после проверки подписи и времени. `initDataUnsafe` для авторизации не используется.

## Развёртывание на Railway

Production-деплой из этого репозитория автоматически использует `Dockerfile`, `railway.json`, healthcheck `/api/health` и pre-deploy миграции. Сам деплой из этой рабочей сессии не выполнялся.

Swagger UI доступен по `/swagger`. `GET /api/diagnostics/database` проверяет PostgreSQL, а `GET /api/diagnostics/telegram` — реального бота, совпадение username и адрес активного webhook.

1. Создайте Railway Project и добавьте **PostgreSQL**.
2. Добавьте **Storage Bucket**, выберите регион и имя. Bucket остаётся приватным.
3. Добавьте приложение из GitHub-репозитория. Railway обнаружит `railway.json`/`Dockerfile`.
4. В Variables приложения добавьте reference `DATABASE_URL` из PostgreSQL.
5. На вкладке Credentials bucket используйте автоматическую инъекцию или добавьте variable references `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `ENDPOINT`, `REGION`. Поставьте `S3_URL_STYLE` в соответствии с указанным там URL style (`virtual` для новых bucket).
6. Добавьте Telegram-переменные, `SESSION_SECRET`, `APP_URL`, `TELEGRAM_WEBAPP_URL`, `NODE_ENV=production`, `DEV_AUTH_ENABLED=false`.
7. Сгенерируйте публичный домен сервиса, обновите `APP_URL`/`TELEGRAM_WEBAPP_URL` и redeploy.
8. Проверьте `https://<домен>/api/health`; ожидается HTTP 200 и `database: "ok"`.
9. В Swagger выполните `GET /api/diagnostics/telegram`; поля `usernameMatches` и `matches` должны быть `true`.
10. Проверьте оба сценария: автоматический вход внутри Mini App и кнопку «Войти через Telegram» в обычном браузере.

`PORT` вручную задавать не нужно: Next.js `next start` читает Railway `PORT`; standalone server также использует `PORT`.

## Seed и проверки

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm db:seed` создаёт демонстрационного продавца и объявления в BYN, USD и RUB. В production seed заблокирован; для осознанного запуска потребуется `SEED_CONFIRM=YES_I_WANT_DEMO_DATA`.

## Что нужно сделать вручную

- Создать Telegram-бота и Mini App в BotFather.
- Создать Railway PostgreSQL, Storage Bucket и приложение.
- Заполнить секреты и variable references; не коммитить `.env`.
- Назначить реальные Telegram ID администраторов.
- Выполнить первый deploy и протестировать автоматически настроенный webhook.
- Настроить backups/alerts Railway и отдельное production-окружение до публичного запуска.

## Осознанные границы MVP

Нет внутреннего чата, оплаты, платного продвижения, автоматической VIN-проверки, дилерских кабинетов и микросервисов. Rate limit хранится в PostgreSQL и подходит для нескольких инстансов; уведомление Telegram выполняется best-effort, поэтому для большого трафика следующим шагом должна стать durable job queue.
