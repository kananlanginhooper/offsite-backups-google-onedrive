import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';

export class HealthDto {
  @ApiProperty({ example: 'ok' }) status: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthDto })
  get(): HealthDto {
    return { status: 'ok' };
  }
}
