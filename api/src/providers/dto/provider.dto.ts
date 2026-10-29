import { ApiProperty } from '@nestjs/swagger';

export class SpaceDto {
  @ApiProperty() takenAt: string;
  @ApiProperty({ type: Number, nullable: true }) totalBytes: number | null;
  @ApiProperty({ type: Number, nullable: true }) usedBytes: number | null;
  @ApiProperty({ type: Number, nullable: true }) freeBytes: number | null;
  @ApiProperty({ type: Number, nullable: true }) trashedBytes: number | null;
}

export class SpaceErrorDto {
  @ApiProperty() at: string;
  @ApiProperty({ description: 'why the check failed, in plain words' })
  reason: string;
  @ApiProperty({ description: "rclone's own last line" }) detail: string;
}

export class ProviderDto {
  @ApiProperty({ enum: ['gdrive', 'onedrive'] }) id: 'gdrive' | 'onedrive';
  @ApiProperty() label: string;
  @ApiProperty({ description: 'rclone remote name; empty when not set up' })
  remote: string;
  @ApiProperty({
    type: SpaceDto,
    nullable: true,
    description: 'latest space check',
  })
  space: SpaceDto | null;
  @ApiProperty({
    type: SpaceErrorDto,
    nullable: true,
    description:
      'the last space check, when it failed after the latest good one',
  })
  lastError: SpaceErrorDto | null;
}
