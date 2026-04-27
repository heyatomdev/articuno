import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpsertUserDto {
  @IsString()
  externalId: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

