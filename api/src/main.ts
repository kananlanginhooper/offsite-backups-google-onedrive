import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config.service';
import { setupApi } from './setup';
import { serveUi } from './web/ui-static';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfig);

  // Honor X-Forwarded-* only from the listed proxies.
  const proxies = config.get('FORWARDED_ALLOW_IPS');
  app.set('trust proxy', proxies.length ? proxies : false);

  // Home dashboards frames this app; only the listed origins may.
  const csp =
    `frame-ancestors 'self' ${config.get('FRAME_ANCESTORS').join(' ')}`.trim();
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', csp);
    next();
  });

  // The UI handlers skip /api, so registering them ahead of Nest's routes (and its 404) is safe.
  const ui = serveUi(
    app.getHttpAdapter().getInstance(),
    config.get('UI_DIST'),
    config.get('UI_BASE_PATH'),
  );
  if (!ui)
    Logger.warn(
      `No UI build at ${config.get('UI_DIST')}; serving the API only`,
      'Bootstrap',
    );

  setupApi(app);
  await app.listen(config.get('PORT'));
}
void bootstrap();
