import { ApiProperty } from '@nestjs/swagger';

const KINDS = ['push', 'restore', 'verify', 'space'] as const;
const STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const;

export class JobRunDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: ['gdrive', 'gphotos', 'onedrive'] }) provider: string;
  @ApiProperty({ enum: KINDS }) kind: (typeof KINDS)[number];
  @ApiProperty({ enum: STATUSES }) status: (typeof STATUSES)[number];
  @ApiProperty() startedAt: string;
  @ApiProperty({ type: String, nullable: true }) finishedAt: string | null;
  @ApiProperty({ type: Number, nullable: true }) filesTotal: number | null;
  @ApiProperty() filesDone: number;
  @ApiProperty({ type: Number, nullable: true }) bytesTotal: number | null;
  @ApiProperty() bytesDone: number;
  @ApiProperty({ type: String, nullable: true }) message: string | null;
}
