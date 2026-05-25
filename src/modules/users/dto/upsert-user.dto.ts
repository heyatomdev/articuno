import { IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertUserDto {
  @ApiProperty({
    description: 'External ID of the user (from your identity provider)',
    example: 'user_abc123',
  })
  @IsString()
  externalId: string;

  @ApiPropertyOptional({
    description: 'Display name / username of the user',
    example: 'johndoe',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'Preferred language code for the user (BCP 47)',
    example: 'it',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'URL of the user\'s avatar image',
    example: 'https://cdn.example.com/avatars/user_abc123.jpg',
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

