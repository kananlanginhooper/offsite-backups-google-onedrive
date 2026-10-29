import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/recovery/client';
import { AppConfig } from '../config/app-config.service';

/** The shared recovery database (MySQL). Read-only: this app never writes to it. */
@Injectable()
export class RecoveryDb extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfig) {
    super({
      adapter: new PrismaMariaDb({
        host: config.get('RECOVERY_DB_HOST'),
        port: config.get('RECOVERY_DB_PORT'),
        database: config.get('RECOVERY_DB_NAME'),
        user: config.get('RECOVERY_DB_USER'),
        password: config.get('RECOVERY_DB_PASSWORD'),
        connectionLimit: 4,
        allowPublicKeyRetrieval: true,
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
