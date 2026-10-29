import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JobRunDto } from './dto/job.dto';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @ApiOkResponse({ type: [JobRunDto] })
  recent(
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
  ): Promise<JobRunDto[]> {
    return this.jobs.recent(Math.min(take, 500));
  }
}
