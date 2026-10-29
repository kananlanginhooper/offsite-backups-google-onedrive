// Placeholder DB settings for code that builds the app without a database (OpenAPI export,
// e2e tests). Import it before AppModule: ConfigModule validates the env when it is imported.
for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'])
  process.env[key] ??= 'unused';
for (const key of [
  'RECOVERY_DB_HOST',
  'RECOVERY_DB_USER',
  'RECOVERY_DB_PASSWORD',
])
  process.env[key] ??= 'unused';
