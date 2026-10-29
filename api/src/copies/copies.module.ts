import { Module } from '@nestjs/common';
import { CopiesController } from './copies.controller';
import { CopiesService } from './copies.service';

@Module({
  controllers: [CopiesController],
  providers: [CopiesService],
  exports: [CopiesService],
})
export class CopiesModule {}
