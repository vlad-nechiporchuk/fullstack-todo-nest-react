# fullstack-todo-nest-react

A ToDo app built API first: a NestJS + PostgreSQL REST API that supports every operation on its own, and a React app
on top of it. One TypeScript monorepo, one shared Zod contract, one command to run.

## Run it

Requires Docker with Compose v2.

```sh
docker compose up --build
```

| What       | Where                                  |
| ---------- | -------------------------------------- |
| Web app    | http://localhost:8080                  |
| Swagger UI | http://localhost:3001/docs             |
| API        | http://localhost:3001/api/v1/tasks     |
| Readiness  | http://localhost:3001/api/health/ready |

Compose starts PostgreSQL, applies migrations in a one-shot `migrate` container, then starts the API and the web app.
The web app's nginx proxies `/api` to the API, so the browser stays on one origin. Every value has a default; to
change a port or a credential, copy `.env.example` to `.env` and edit it.

## Try the API without the UI

- **Swagger UI** at `/docs`: every endpoint, its schemas and its error responses, runnable from the browser.
- **`.http` files** in [`apps/api/http/`](apps/api/http): one block per endpoint for the VS Code REST Client or the
  JetBrains HTTP client, including the `If-Match` conflict case.
- **curl:**

```sh
curl -i -X POST localhost:3001/api/v1/tasks -H 'Content-Type: application/json' -d '{"title":"Buy milk"}'
curl 'localhost:3001/api/v1/tasks?status=active&limit=20&offset=0'
curl -i -X PATCH localhost:3001/api/v1/tasks/<id> -H 'Content-Type: application/json' -H 'If-Match: "1"' \
  -d '{"completed":true}'
curl -i -X DELETE localhost:3001/api/v1/tasks/<id>
```

| Method   | Path                | Does                                                        |
| -------- | ------------------- | ----------------------------------------------------------- |
| `GET`    | `/api/v1/tasks`     | A page of tasks, newest first: `status`, `limit`, `offset`  |
| `POST`   | `/api/v1/tasks`     | Create a task; `201` with `Location` and `ETag`             |
| `GET`    | `/api/v1/tasks/:id` | One task with its `ETag`                                    |
| `PATCH`  | `/api/v1/tasks/:id` | Rename and/or complete; optional `If-Match`, `412` if stale |
| `DELETE` | `/api/v1/tasks/:id` | Delete; `204`                                               |
| `GET`    | `/api/health/live`  | Liveness, checks no dependencies                            |
| `GET`    | `/api/health/ready` | Readiness, `503` while the database is unreachable          |

A list page carries `total` for its filter and `counts` for every filter, so the UI shows tab counts without extra
requests. Every error is an RFC 9457 `application/problem+json` body whose `type` a client can branch on.

## Develop locally

Requires Node 22 (`.nvmrc`) and pnpm 9 (`corepack enable` picks the version from `package.json`).

```sh
pnpm install
pnpm build
cp apps/api/.env.example apps/api/.env
docker compose up -d postgres
pnpm --filter api migration:run
pnpm dev
```

Both apps import the shared contract from `packages/common/dist`, so `pnpm build` comes before any command that starts
one of them directly, such as the migrations or `dev:debug`.

`pnpm dev` builds `packages/common`, then runs the API on :3001 in watch mode and the Vite dev server with hot reload on
http://localhost:3000. Vite proxies `/api` to :3001 the way nginx does in Docker, so the browser needs no CORS in either
mode.

| Mode                          | Web app                   | API                   | Database       |
| ----------------------------- | ------------------------- | --------------------- | -------------- |
| `docker compose up`           | :8080, nginx, built files | :3001, built image    | :55432, Docker |
| `pnpm dev`                    | :3000, Vite, hot reload   | :3001, watch mode     | :55432, Docker |
| `pnpm turbo dev --filter=web` | :3000, Vite, hot reload   | :3001, the Docker one | :55432, Docker |

The web app has a different port in each mode, so Docker and Vite can run at once. The API has one port: before
`pnpm dev`, stop the Docker one with `docker compose stop api`. To work on the UI alone, keep the whole stack in Docker
and run only `pnpm turbo dev --filter=web`, which builds `packages/common` first. `pnpm --filter api dev:debug` starts
the API with the Node inspector on 127.0.0.1:9229.

| Command                                                      | What                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| `pnpm lint` / `pnpm format`                                  | Biome check / write                                     |
| `pnpm typecheck`                                             | `tsc --noEmit` in every package                         |
| `pnpm test:unit`                                             | Unit tests, no services needed                          |
| `pnpm test:int`                                              | API integration tests against PostgreSQL                |
| `pnpm build`                                                 | Build every package                                     |
| `pnpm --filter api migration:generate src/migrations/<Name>` | Diff the entities against the database into a migration |
| `pnpm --filter api migration:run`                            | Apply pending migrations                                |
| `pnpm --filter api migration:revert`                         | Revert the last migration                               |

The integration tests use the `todo_test` database, which the Postgres container creates on its first start. They
drop and re-migrate its schema on every run, so development data is never touched. `TEST_DATABASE_URL` points them at
another database.

## Layout

| Path                         | What                                                                  |
| ---------------------------- | --------------------------------------------------------------------- |
| `apps/api`                   | NestJS API, TypeORM, migrations, `.http` files                        |
| `apps/web`                   | React SPA: Vite, TanStack Query, Tailwind; nginx image                |
| `packages/common`            | Zod schemas and inferred types: the API contract, shared by both apps |
| `packages/typescript-config` | Shared tsconfig bases                                                 |
| `docs/adr`                   | Architecture decisions with the alternatives that were rejected       |

## How it is tested

| Tier             | Where                         | Proves                                                                   |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------ |
| Unit             | `**/__tests__/*.unit-spec.ts` | Contract schemas, service rules, ETag parsing, error mapping, env config |
| API integration  | `apps/api/test/integration`   | Every endpoint over HTTP against real PostgreSQL, concurrent updates     |
| Web component    | `apps/web/src/**/__tests__`   | The task board against a fake API (MSW): changes, locks, failures        |
| Whole stack (CI) | `.github/workflows/ci.yml`    | `docker compose up` and a smoke test through nginx                       |

Integration tests are where the API's behaviour is pinned: status codes, problem bodies, paging, `If-Match` races. Unit
tests cover logic with branches worth isolating. CI runs lint, typecheck, all tests and the build on every pull
request, then starts the whole stack and smoke-tests it.

## Conventions

- **The contract lives in `packages/common`.** The API validates requests and responses with the same Zod schemas
  the web app derives its types from, and Swagger is generated from them. A contract change is made in one place.
- **API layers: `common → platform → core`.** A layer imports only layers to its left: `common` is framework glue
  (config, errors, HTTP helpers), `platform` is infrastructure (database, health), `core` is the task domain.
- **Only a `*.dao.ts` touches TypeORM.** Services hold the rules, controllers only translate HTTP.
- **The schema changes through migrations only.** `synchronize` is off everywhere; an entity and its migration are
  committed together.
- **Every error is `application/problem+json`,** produced in one exception filter.
- **Conventional Commits,** one pull request per finished step.

## Decisions

- [0001: Shared Zod contract](docs/adr/0001-shared-zod-contract.md)
- [0002: Optimistic concurrency with ETag and If-Match](docs/adr/0002-optimistic-concurrency.md)
- [0003: Hard delete](docs/adr/0003-hard-delete.md)
- [0004: Offset pagination with per-filter counts](docs/adr/0004-offset-pagination.md)
- [0005: Row-local optimistic feedback without optimistic cache updates](docs/adr/0005-row-local-optimistic-feedback.md)

## Out of scope

Kept out on purpose; each is the next step for a real deployment, not a gap in what was asked.

- **Authentication and per-user tasks.** Every task is shared by everyone who can reach the app, so a public
  deployment needs an access decision first: authentication and an owner on each task.
- **Keyset pagination.** Offset paging is fine at this size; see ADR 0004.
- **Caching the counts.** They are computed per request with one grouped query.
- **Deployment.** The images are production-shaped (multi-stage, non-root, health checks), but nothing deploys them.
- **Rate limiting, metrics and tracing.** Logs are structured JSON with a request id.
