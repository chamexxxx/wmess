# WMess

**WMess** – это единое рабочее пространство для команды: чаты с тредами, голосовыми сообщениями и созвонами, документы, таблицы и доски с совместным редактированием в реальном времени, файловое хранилище, трекер задач и общий календарь. Всё необходимое для работы команды собрано в одном приложении, без переключения между сервисами.

---

## Использованные технологии

### Языки

- **C#** (.NET 10) — серверная часть (API и BFF)
- **TypeScript** — клиентское приложение
- **SQL** (PostgreSQL) — хранилище данных

### Бэкенд

- **ASP.NET Core** — веб-API и хостинг
- **Entity Framework Core** + **Npgsql** — ORM и доступ к PostgreSQL
- **ASP.NET Core Identity** — пользователи и аутентификация
- **JWT (Bearer)** — токены авторизации
- **SignalR** (+ протокол MessagePack) — обмен сообщениями и события в реальном времени
- **YARP** — реверс-прокси в составе BFF
- **nginx** — внешний реверс-прокси и TLS-терминатор (HTTPS)
- **OpenAPI** + **Scalar** — описание и просмотр API

### Фронтенд

- **React 19** — UI
- **Vite** — сборка и dev-сервер
- **Tailwind CSS** — стилизация
- **Zustand** — управление состоянием
- **React Router** — маршрутизация
- **Axios** — HTTP-запросы
- **SignalR client** — реал-тайм-подключение к серверу
- **Yjs** (+ y-protocols) — CRDT для совместного редактирования в реальном времени
- **Lexical** — редактор форматированного текста
- **Excalidraw** — доски для рисования
- **FullCalendar** — общий календарь
- **WaveSurfer.js** — визуализация голосовых сообщений

### Подходы и архитектура

- **BFF (Backend-for-Frontend)** — отдельный слой (WMess.Web) с YARP, проксирующий запросы к API и отдающий SPA
- **TLS-терминация на nginx** — наружу торчит только nginx (HTTPS), остальные сервисы общаются по внутренней сети по HTTP
- **Real-time-коммуникация** через SignalR и WebSocket
- **Совместное редактирование** документов и досок на основе CRDT (Yjs)
- **Генерация типизированного API-клиента** из OpenAPI-спецификации (swagger-typescript-api)
- **Контейнеризация** через Docker и Docker Compose
- **Автоматические миграции БД** при старте

---

## Запуск в продакшене через Docker (Linux)

Всё приложение (nginx + PostgreSQL + API + BFF со встроенным SPA) поднимается одной командой. Наружу торчит только **nginx**, который терминирует HTTPS; API, BFF и БД общаются внутри сети compose по HTTP.

**Требуется:** Linux-сервер с Docker Engine и плагином Docker Compose v2 ([инструкция по установке](https://docs.docker.com/engine/install/)). Проверить: `docker compose version`.

1. Склонировать репозиторий и перейти в его каталог:
   ```bash
   git clone https://github.com/chamexxxx/wmess.git && cd wmess
   ```
2. Задать секреты — скопировать `.env.example` в `.env` и поменять `JWT_SECRET` (минимум 32 символа) и `DB_PASSWORD`. Там же указывается `SERVER_NAME` (домен / CN сертификата) и внешние порты `HTTP_PORT`/`HTTPS_PORT`:
   ```bash
   cp .env.example .env
   # сгенерировать стойкие секреты:
   sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 48)|" .env
   sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')|" .env
   # прописать свой домен:
   sed -i "s|^SERVER_NAME=.*|SERVER_NAME=example.com|" .env
   ```
3. Положить TLS-сертификат и ключ в `nginx/certs/` под именами `server.crt` и `server.key`.

   **Продакшен (реальный домен):** получить сертификат от Let's Encrypt и скопировать под нужными именами:
   ```bash
   sudo certbot certonly --standalone -d example.com
   sudo cp /etc/letsencrypt/live/example.com/fullchain.pem nginx/certs/server.crt
   sudo cp /etc/letsencrypt/live/example.com/privkey.pem   nginx/certs/server.key
   ```

   **Тест (самоподписанный):**
   ```bash
   openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
     -keyout nginx/certs/server.key -out nginx/certs/server.crt \
     -subj "/CN=localhost" \
     -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
   ```

   Ограничить права на приватный ключ:
   ```bash
   chmod 600 nginx/certs/server.key
   ```
4. Собрать и запустить:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
5. Открыть **https://<домен>** (или `https://localhost` при локальном тесте; внешний порт меняется через `HTTPS_PORT`). HTTP автоматически редиректит на HTTPS. С самоподписанным сертификатом браузер покажет предупреждение — это ожидаемо.

Миграции БД применяются автоматически при старте. Данные сохраняются в volume'ах (`wmess_prod_pg` — база, `wmess_prod_uploads` — вложения чата).

**Логи и статус:**
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

**Остановить:**
```bash
docker compose -f docker-compose.prod.yml down        # оставить данные
docker compose -f docker-compose.prod.yml down -v      # удалить и данные
```

> На сервере открой порты `80`/`443` в фаерволе (например, `sudo ufw allow 80,443/tcp`). TLS завершается на nginx; внутри сети сервисы ходят по HTTP. Сертификаты (`nginx/certs/*.crt`, `*.key`) в git не коммитятся. Let's Encrypt-сертификаты живут 90 дней — обновляй их (`certbot renew`) и перезапускай nginx: `docker compose -f docker-compose.prod.yml restart nginx`.

---

[ROADMAP](ROADMAP.md)
