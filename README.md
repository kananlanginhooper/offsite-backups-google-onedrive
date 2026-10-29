# Offsite backups: Google Drive + OneDrive

A dashboard to track, save and restore offsite copies of a home file library on Google Drive and OneDrive. [rclone](https://rclone.org) moves the files.

**Live demo (mock data, no back end):** https://kananlanginhooper.github.io/offsite-backups-google-onedrive/

## What it shows

- **Overview:** space used and free on each provider (from `rclone about`), how many files and bytes are offsite per provider, and a chart of the bytes verified per day.
- **Copies:** every offsite copy, filtered by provider and searched by content hash or path. A copy can be restored from here.
- **Restores:** each restore copies one file down from the provider into its own new folder. The provider is only read, and nothing on the server is overwritten.
- **Jobs:** push, restore, verify and space-check runs with their progress.

## How it fits together

- **`api/`**: NestJS 11. It has one module per feature (`providers`, `copies`, `restores`, `jobs`), validated config (`@nestjs/config` + zod), OpenAPI from `@nestjs/swagger` (at `/api/docs`), and Prisma 7 for both databases:
  - **The catalogue database (MySQL, read-only):** its `offsite_copy` table records every copy, keyed by the file's sha256. The push jobs write it, and it's the source of truth for what's offsite.
  - **This app's own database (Postgres):** job runs, restore requests and space snapshots.
  - It also serves the built UI, with `<base href>` set from `UI_BASE_PATH` at request time, plus `GET /api/config`. It sends `Content-Security-Policy: frame-ancestors` from `FRAME_ANCESTORS`, so the app can be framed by a dashboard shell.
- **`pusher/`**: the Google Drive and OneDrive push jobs (Python + rclone), configured from the same `.env`. See `pusher/README.md`.
- **`ui/`**: Angular 20. It uses standalone OnPush components with signals, Angular Material, Apache ECharts (`ngx-echarts`), and a flat `core/ shared/ features/` layout. The API types are generated from the back end's OpenAPI (`npm run api-types`).
- **Pages demo:** the `demo` build swaps the data source (`core/data/mode.ts` → `mode.demo.ts`) for made-up data kept in the browser, and writes to `docs/`.

## Development

```bash
cd api && npm install && npm run build && npm run openapi   # writes api/openapi.json
cd ui && npm install && npm run api-types && npm start       # ng serve, proxies /api to :8101
cd ui && npm run build:demo                                  # Pages demo -> docs/
```

All settings come from `.env` (see `.env.example`). `docker compose up -d --build` runs the API and UI as one container, published on the one IPv4 address in `BIND_ADDR`, on the shared external Docker network `homelab`, created once per host (`docker network create --subnet <shared subnet> homelab`). The rclone config folder is mounted read-only.
