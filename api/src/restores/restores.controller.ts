import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateRestoreDto, RestoreDto } from './dto/restore.dto';
import { RestoresService } from './restores.service';

@ApiTags('restores')
@Controller('restores')
export class RestoresController {
  constructor(private readonly restores: RestoresService) {}

  @Get()
  @ApiOkResponse({ type: [RestoreDto] })
  recent(
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
  ): Promise<RestoreDto[]> {
    return this.restores.recent(Math.min(take, 500));
  }

  @Post()
  @ApiCreatedResponse({ type: RestoreDto })
  create(@Body() body: CreateRestoreDto): Promise<RestoreDto> {
    return this.restores.create(body.copyId);
  }
}
