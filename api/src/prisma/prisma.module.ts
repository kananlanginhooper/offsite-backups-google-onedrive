import { Global, Module } from '@nestjs/common';
import { AppDb } from './app-db.service';
import { RecoveryDb } from './recovery-db.service';

@Global()
@Module({ providers: [AppDb, RecoveryDb], exports: [AppDb, RecoveryDb] })
export class PrismaModule {}
