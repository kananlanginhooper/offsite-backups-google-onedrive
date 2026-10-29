// Prisma CLI config for this app's own database. The recovery schema is generate-only.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const { DB_HOST, DB_PORT = '5432', DB_NAME, DB_USER, DB_PASSWORD } = process.env;
const url = DB_HOST
  ? `postgresql://${encodeURIComponent(DB_USER ?? '')}:${encodeURIComponent(DB_PASSWORD ?? '')}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
  : undefined;

export default defineConfig({
  schema: 'prisma/app.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url },
});
