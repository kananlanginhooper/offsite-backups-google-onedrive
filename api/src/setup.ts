import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** Settings shared by the server (main.ts) and the OpenAPI export (openapi.ts). */
export function setupApi(app: INestApplication): OpenAPIObject {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Offsite backups')
      .setDescription(
        'Track, save and restore offsite copies on Google Drive and OneDrive',
      )
      .setVersion('0.1.0')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, doc);
  return doc;
}
