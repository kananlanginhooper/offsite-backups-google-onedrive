import { ApiProperty } from '@nestjs/swagger';

export class LoginConfigDto {
  @ApiProperty() enabled: boolean;
  @ApiProperty() issuer: string;
  @ApiProperty() clientId: string;
}

/** What the Angular UI loads before it starts. */
export class UiConfigDto {
  @ApiProperty({ example: 'api' }) apiBase: string;
  @ApiProperty({ example: '/' }) basePath: string;
  @ApiProperty() publicUrl: string;
  @ApiProperty({ type: [String] }) frameParents: string[];
  @ApiProperty({ type: LoginConfigDto }) login: LoginConfigDto;
}
