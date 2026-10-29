import { Module } from '@nestjs/common';
import { CopiesModule } from '../copies/copies.module';
import { ProvidersModule } from '../providers/providers.module';
import { RestoresController } from './restores.controller';
import { RestoresService } from './restores.service';

@Module({
  imports: [CopiesModule, ProvidersModule],
  controllers: [RestoresController],
  providers: [RestoresService],
})
export class RestoresModule {}
