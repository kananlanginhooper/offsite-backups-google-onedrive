import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PROVIDERS, type ProviderId } from '../../common/providers';

export class CopyDto {
  @ApiProperty() id: number;
  @ApiProperty({ description: 'sha256 of the content' }) hash: string;
  @ApiProperty({ enum: PROVIDERS }) provider: ProviderId;
  @ApiProperty() remotePath: string;
  @ApiProperty({ type: Number, nullable: true }) size: number | null;
  @ApiProperty() placedBy: string;
  @ApiProperty() verifiedBy: string;
  @ApiProperty({ type: String, nullable: true }) verifiedAt: string | null;
}

export class CopyPageDto {
  @ApiProperty({ type: [CopyDto] }) items: CopyDto[];
  @ApiProperty() total: number;
}

export class CopyQueryDto {
  @ApiPropertyOptional({ enum: PROVIDERS })
  @IsOptional()
  @IsIn(PROVIDERS)
  provider?: ProviderId;

  @ApiPropertyOptional({
    description: 'hash prefix or part of the remote path',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip = 0;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take = 50;
}

export class ProviderTotalsDto {
  @ApiProperty({ enum: PROVIDERS }) provider: ProviderId;
  @ApiProperty() files: number;
  @ApiProperty() bytes: number;
  @ApiProperty({ type: String, nullable: true }) lastVerifiedAt: string | null;
}

export class DailyTotalsDto {
  @ApiProperty({ example: '2026-10-28' }) day: string;
  @ApiProperty({ enum: PROVIDERS }) provider: ProviderId;
  @ApiProperty() files: number;
  @ApiProperty() bytes: number;
}
