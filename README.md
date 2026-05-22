# Менеджер задач (TaskFlow)

[![CI](https://github.com/ol7timist/task-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/ol7timist/task-manager/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/node-20.x-green)
![TypeScript](https://img.shields.io/badge/typescript-5.6-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

Веб-додаток для управління задачами з командною роботою, реалізований за **сучасними підходами проєктування архітектури**: шарувата (Clean) архітектура, Dependency Injection, Repository, DTO, SOLID-принципи.

> Курсова робота · Загорянський М. В., ФеП-31, ЛНУ ім. І. Франка.

---

## Стек

| Шар | Технологія |
|-----|-----------|
| Мова | TypeScript 5.6 (Node.js 20) |
| Веб-фреймворк | Express 4 |
| ORM + міграції | Prisma 5 |
| База даних | PostgreSQL 16 |
| Кеш | Redis 7 |
| Валідація | Zod |
| Аутентифікація | JWT (jsonwebtoken) + bcryptjs |
| Логування | pino + pino-http |
| Тести | Jest + ts-jest + supertest |
| Лінтер | ESLint + Prettier |
| Контейнеризація | Docker + docker-compose |
| CI/CD | GitHub Actions + GHCR |

---

## Архітектура

```
HTTP Request
   │
   ▼
┌───────────────────────────────────────┐
│ Middleware (helmet, cors, pino-http,  │
│ auth, validate)                       │
└───────────────────────────────────────┘
   │
   ▼
┌─────────────┐    ┌───────────────┐    ┌──────────────────┐    ┌──────────┐
│ Controllers │───▶│   Services    │───▶│  Repositories    │───▶│ Prisma + │
│ (тонкі)     │    │ (бізнес-      │    │ (доступ до даних)│    │ Postgres │
└─────────────┘    │  логіка)      │    └──────────────────┘    └──────────┘
                   └───────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │ Redis (кеш)   │
                   └───────────────┘
```

Композиція залежностей зібрана в одному місці — `src/config/container.ts` (composition root).

---

## Запуск через Docker (рекомендовано)

### 1. Підготовка змінних середовища

```bash
cp .env.example .env
# відредагуй JWT_SECRET, POSTGRES_PASSWORD
```

### 2. Запуск всього стеку

```bash
docker-compose up -d
```

Будуть запущені:

| Сервіс | Порт | Призначення |
|--------|------|-------------|
| `app`   | `3000` | Node.js додаток |
| `db`    | `5432` | PostgreSQL |
| `redis` | `6379` | Кеш |

Міграції БД накатуються автоматично при старті контейнера `app`.

### 3. Перевірка

```bash
curl http://localhost:3000/healthz
# {"status":"ok","uptime":2.13}
```

### 4. Додаткові інструменти (профіль `dev-tools`)

```bash
docker-compose --profile dev-tools up -d
# Adminer UI: http://localhost:8080  (System: PostgreSQL, Server: db, User: taskmgr)
```

### 5. Запуск тестів у контейнері

```bash
docker-compose --profile test up --build test
```

### Зупинка

```bash
docker-compose down            # зупинити
docker-compose down -v         # + видалити томи
```

---

## Локальний запуск (без Docker)

Потрібні: Node.js 20+, локальний PostgreSQL і Redis.

```bash
# 1. Залежності
npm install

# 2. Згенерувати Prisma client
npm run prisma:generate

# 3. Підготувати БД
cp .env.example .env
# відредагуй DATABASE_URL під свій локальний Postgres
npm run prisma:migrate:dev
npm run prisma:seed         # опціонально — демо-дані

# 4. Запуск (з гарячим перезавантаженням)
npm run dev
# або production-режим
npm run build && npm start
```

---

## Змінні середовища

| Змінна | За замовчуванням | Опис |
|--------|------------------|------|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `3000` | Порт HTTP-сервера |
| `DATABASE_URL` | — | Повний URL PostgreSQL для Prisma |
| `POSTGRES_USER` | `taskmgr` | Логін БД (для compose) |
| `POSTGRES_PASSWORD` | `changeme_in_prod` | Пароль БД (**обов'язково змінити**) |
| `POSTGRES_DB` | `taskmgr` | Назва БД |
| `REDIS_URL` | `redis://localhost:6379` | URL Redis |
| `JWT_SECRET` | — | Секрет для підпису JWT (мін. 16 символів, **обов'язково**) |
| `JWT_EXPIRES_IN` | `7d` | Термін життя токена |
| `BCRYPT_ROUNDS` | `10` | Кількість раундів bcrypt (4–15) |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` |

При запуску ENV валідуються через Zod — якщо щось не так, додаток упаде з повідомленням.

---

## API-ендпоінти

База: `/api/v1`. Усі ендпоінти, крім `/auth/register` та `/auth/login`, вимагають заголовок `Authorization: Bearer <token>`.

### Аутентифікація

| Метод | Шлях | Опис |
|-------|------|------|
| `POST` | `/auth/register` | Реєстрація (`email`, `password`, `name`) → `{ user, accessToken }` |
| `POST` | `/auth/login` | Логін → `{ user, accessToken }` |
| `GET`  | `/auth/me` | Поточний користувач |

### Проєкти

| Метод | Шлях | Опис |
|-------|------|------|
| `GET`    | `/projects` | Список проєктів користувача |
| `POST`   | `/projects` | Створити проєкт |
| `GET`    | `/projects/:id` | Деталі + лічильники |
| `PATCH`  | `/projects/:id` | Оновити (тільки власник) |
| `DELETE` | `/projects/:id` | Видалити (тільки власник) |
| `POST`   | `/projects/:id/members` | Додати члена (тільки власник) |
| `DELETE` | `/projects/:id/members/:userId` | Видалити члена |

### Задачі

| Метод | Шлях | Опис |
|-------|------|------|
| `GET`    | `/projects/:projectId/tasks?status=TODO&priority=HIGH&search=docs&page=1&pageSize=20` | Список з пагінацією та фільтрацією |
| `POST`   | `/projects/:projectId/tasks` | Створити задачу |
| `GET`    | `/tasks/:id` | Деталі задачі |
| `PATCH`  | `/tasks/:id` | Оновити |
| `DELETE` | `/tasks/:id` | Видалити (creator / assignee / owner) |

### Коментарі

| Метод | Шлях | Опис |
|-------|------|------|
| `GET`    | `/tasks/:taskId/comments` | Коментарі задачі |
| `POST`   | `/tasks/:taskId/comments` | Додати коментар |
| `DELETE` | `/comments/:id` | Видалити (автор або власник проєкту) |

### Статистика (з кешуванням)

| Метод | Шлях | Опис |
|-------|------|------|
| `GET` | `/projects/:projectId/stats` | Кількість задач по статусах (кеш 60 с) |

### Health-check

| Метод | Шлях | Опис |
|-------|------|------|
| `GET` | `/healthz` | Стан сервісу (для Docker/CI) |

### Приклад запиту

```bash
# Реєстрація
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123","name":"Alice"}'

# Збереження токена
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}' \
  | jq -r .accessToken)

# Створення проєкту
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Курсова","description":"Менеджер задач"}'
```

---

## Тести

### Структура

```
tests/
├── setup.ts                            # Фіктивні ENV для тестів
└── unit/
    ├── auth.service.test.ts            # 7 тестів
    ├── project.service.test.ts         # 10 тестів
    ├── task.service.test.ts            # 9 тестів
    └── stats.service.test.ts           # 4 тести
```

Усього **30 юніт-тестів**. Репозиторії мокаються, БД та Redis не потрібні.

### Запуск

```bash
npm run lint          # ESLint
npm run test:unit     # Юніт-тести з покриттям
npm test              # Все разом

# У Docker
docker-compose --profile test up --build test
```

Очікуваний результат:

```
Test Suites: 4 passed, 4 total
Tests:       30 passed, 30 total
```

Покриття зберігається у `coverage/lcov-report/index.html`.

---

## CI/CD

GitHub Actions виконує при кожному push:

1. **lint** — `npm run lint` (ESLint + Prettier).
2. **test** — `tsc --noEmit` + `npm run test:unit` (з сервісами Postgres + Redis).
3. **docker** — збірка Docker-образу та публікація у GitHub Container Registry (GHCR) з тегами `latest`, `sha-<commit>`, `<branch>`.

Конфігурація — `.github/workflows/ci.yml`.

---

## Перевірка результату

1. **Через браузер:** відкрий http://localhost:3000/healthz — має повернутись `{"status":"ok"}`.
2. **Через Postman / curl:** використай приклади з розділу «API-ендпоінти».
3. **Через Adminer:** запусти з профілем `dev-tools`, відкрий http://localhost:8080 і подивись таблиці.
4. **Логи додатку:** `docker-compose logs -f app`.

---

## Структура проєкту

```
task-manager/
├── Dockerfile, Dockerfile.test, docker-compose.yaml
├── package.json, tsconfig.json, jest.config.js, .eslintrc.json, .prettierrc
├── .env.example, .gitignore, .dockerignore
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── .github/workflows/ci.yml
├── src/
│   ├── server.ts                      # Точка входу
│   ├── app.ts                         # Фабрика Express
│   ├── config/
│   │   ├── env.ts, database.ts, redis.ts, container.ts
│   ├── domain/errors.ts
│   ├── dto/                           # auth, project, task, comment
│   ├── repositories/                  # user, project, task, comment
│   ├── services/                      # auth, project, task, comment, stats
│   ├── controllers/                   # 5 контролерів
│   ├── routes/index.ts                # 20+ ендпоінтів
│   ├── middleware/                    # auth, validate, error
│   └── utils/                         # logger, password, jwt
└── tests/unit/                        # 30 юніт-тестів
```

---

## Ліцензія

MIT
