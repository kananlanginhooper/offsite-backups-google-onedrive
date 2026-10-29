import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CopiesService } from './copies.service';
import {
  CopyDto,
  CopyPageDto,
  CopyQueryDto,
  DailyTotalsDto,
  ProviderTotalsDto,
} from './dto/copy.dto';

@ApiTags('copies')
@Controller('copies')
export class CopiesController {
  constructor(private readonly copies: CopiesService) {}

  @Get()
  @ApiOkResponse({ type: CopyPageDto })
  page(@Query() query: CopyQueryDto): Promise<CopyPageDto> {
    return this.copies.page(query);
  }

  @Get('totals')
  @ApiOkResponse({ type: [ProviderTotalsDto] })
  totals(): Promise<ProviderTotalsDto[]> {
    return this.copies.totals();
  }

  @Get('daily')
  @ApiOkResponse({ type: [DailyTotalsDto] })
  daily(
    @Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number,
  ): Promise<DailyTotalsDto[]> {
    return this.copies.daily(days);
  }

  @Get(':id')
  @ApiOkResponse({ type: CopyDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<CopyDto> {
    return this.copies.get(id);
  }
}
