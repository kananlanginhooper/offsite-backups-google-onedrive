import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { ConnectService } from './connect.service';
import {
  ConnectFinishDto,
  ConnectResultDto,
  ConnectStartDto,
} from './dto/connect.dto';
import { ProviderDto, SpaceDto } from './dto/provider.dto';
import { ProvidersService } from './providers.service';

const REMOTE_IDS = ['gdrive', 'onedrive'] as const;
type RemoteId = (typeof REMOTE_IDS)[number];
const idPipe = new ParseEnumPipe({ gdrive: 'gdrive', onedrive: 'onedrive' });

@ApiTags('providers')
@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly providers: ProvidersService,
    private readonly connector: ConnectService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [ProviderDto] })
  list(): Promise<ProviderDto[]> {
    return this.providers.list();
  }

  @Post(':id/space')
  @ApiParam({ name: 'id', enum: REMOTE_IDS })
  @ApiOkResponse({ type: SpaceDto })
  checkSpace(@Param('id', idPipe) id: RemoteId): Promise<SpaceDto> {
    return this.providers.checkSpace(id);
  }

  @Post(':id/connect')
  @ApiParam({ name: 'id', enum: REMOTE_IDS })
  @ApiOkResponse({ type: ConnectStartDto })
  connect(@Param('id', idPipe) id: RemoteId): Promise<ConnectStartDto> {
    return this.connector.start(id);
  }

  @Post(':id/connect/finish')
  @ApiParam({ name: 'id', enum: REMOTE_IDS })
  @ApiOkResponse({ type: ConnectResultDto })
  connectFinish(
    @Param('id', idPipe) id: RemoteId,
    @Body() body: ConnectFinishDto,
  ): Promise<ConnectResultDto> {
    return this.connector.finish(id, body.url);
  }

  @Get(':id/space')
  @ApiParam({ name: 'id', enum: REMOTE_IDS })
  @ApiOkResponse({ type: [SpaceDto] })
  spaceHistory(
    @Param('id', idPipe) id: RemoteId,
    @Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number,
  ): Promise<SpaceDto[]> {
    return this.providers.spaceHistory(id, days);
  }
}
