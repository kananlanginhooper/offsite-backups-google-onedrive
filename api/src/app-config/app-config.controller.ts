import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AppConfig } from '../config/app-config.service';
import { UiConfigDto } from './dto/ui-config.dto';

@ApiTags('config')
@Controller('config')
export class AppConfigController {
  constructor(private readonly config: AppConfig) {}

  @Get()
  @ApiOkResponse({ type: UiConfigDto })
  get(): UiConfigDto {
    return {
      apiBase: 'api',
      basePath: this.config.get('UI_BASE_PATH'),
      publicUrl: this.config.get('PUBLIC_URL'),
      frameParents: this.config.get('FRAME_ANCESTORS'),
      login: {
        enabled: this.config.get('LOGIN') === 'on',
        issuer: this.config.get('OIDC_ISSUER'),
        clientId: this.config.get('OIDC_CLIENT_ID'),
      },
    };
  }
}
