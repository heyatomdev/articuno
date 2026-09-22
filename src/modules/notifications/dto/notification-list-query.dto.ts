import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageParams } from '@/common/pagination';

export class NotificationListQueryDto extends PageParams {
  @ApiPropertyOptional({
    description: 'Filter by notification type',
    example: 'comment.moderated',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Filter by sentToClient status',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  sentToClient?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by userId (internal UUID)',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

