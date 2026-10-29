import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreateRestoreDto {
  @ApiProperty({ description: 'id of the offsite copy to bring back' })
  @IsInt()
  @Min(1)
  copyId: number;
}

export class RestoreDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: ['gdrive', 'gphotos', 'onedrive'] }) provider: string;
  @ApiProperty({ type: String, nullable: true }) hash: string | null;
  @ApiProperty() remotePath: string;
  @ApiProperty({ description: 'where the file lands on the server' })
  destination: string;
  @ApiProperty({ enum: ['queued', 'running', 'succeeded', 'failed'] })
  status: string;
  @ApiProperty() requestedAt: string;
  @ApiProperty({ type: String, nullable: true }) finishedAt: string | null;
  @ApiProperty({ type: Number, nullable: true }) bytes: number | null;
  @ApiProperty({ type: String, nullable: true }) error: string | null;
}
