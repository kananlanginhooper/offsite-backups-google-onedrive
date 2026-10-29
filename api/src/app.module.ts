import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RcloneModule } from './rclone/rclone.module';
import { HealthModule } from './health/health.module';
import { UiConfigModule } from './app-config/app-config.module';
import { ProvidersModule } from './providers/providers.module';
import { CopiesModule } from './copies/copies.module';
import { RestoresModule } from './restores/restores.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RcloneModule,
    HealthModule,
    UiConfigModule,
    ProvidersModule,
    CopiesModule,
    RestoresModule,
    JobsModule,
  ],
})
export class AppModule {}
