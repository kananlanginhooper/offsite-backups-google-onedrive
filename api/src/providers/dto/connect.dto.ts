import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { ProviderDto } from './provider.dto';

export class ConnectStartDto {
  @ApiProperty({
    description: "the provider's sign-in page; open it in a new tab",
  })
  authUrl: string;
  @ApiProperty({
    description:
      'where the provider sends the browser after approval (a page that will not load); its full address is pasted back',
  })
  redirectUri: string;
}

export class ConnectFinishDto {
  @ApiProperty({
    description: 'the full address the browser landed on after approving',
  })
  @IsString()
  @MaxLength(4000)
  url: string;
}

export class ConnectResultDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'the account that signed in, when the provider says',
  })
  account: string | null;
  @ApiProperty({ type: ProviderDto }) provider: ProviderDto;
}
