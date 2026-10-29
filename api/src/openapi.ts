// Writes openapi.json without starting the server or touching a database:
// npm run build && npm run openapi. The UI generates its types from that file.
import './placeholder-env';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { AppModule } from './app.module';
import { setupApi } from './setup';

async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error'],
    abortOnError: false,
  });
  const doc = setupApi(app);
  writeFileSync('openapi.json', JSON.stringify(doc, null, 2) + '\n');
  await app.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
