import { ApiProperty } from '@nestjs/swagger';

export class SpaceDto {
  @ApiProperty() takenAt: string;
  @ApiProperty({ type: Number, nullable: true }) totalBytes: number | null;
  @ApiProperty({ type: Number, nullable: true }) usedBytes: number | null;
  @ApiProperty({ type: Number, nullable: true }) freeBytes: number | null;
  @ApiProperty({ type: Number, nullable: true }) trashedBytes: number | null;
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
}
