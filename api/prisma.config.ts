// Prisma CLI config for this app's own database. The recovery schema is generate-only.
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The repo keeps one .env at its root; real env vars (the container) win over both files.
config({ path: ['.env', '../.env'], quiet: true });

const {
  DB_HOST,
  DB_PORT = '5432',
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
} = process.env;
const url = DB_HOST
  ? `postgresql://${encodeURIComponent(DB_USER ?? '')}:${encodeURIComponent(DB_PASSWORD ?? '')}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
  : undefined;

export default defineConfig({
  schema: 'prisma/app.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url },
});
