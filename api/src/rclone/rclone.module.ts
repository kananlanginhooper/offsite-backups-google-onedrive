import { Global, Module } from '@nestjs/common';
import { RcloneService } from './rclone.service';

@Global()
@Module({ providers: [RcloneService], exports: [RcloneService] })
export class RcloneModule {}
