import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/app/client';
import { AppConfig } from '../config/app-config.service';

/** This app's own Postgres database. Connects on first query. */
@Injectable()
export class AppDb extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfig) {
    super({
      adapter: new PrismaPg({
        host: config.get('DB_HOST'),
        port: config.get('DB_PORT'),
        database: config.get('DB_NAME'),
        user: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
