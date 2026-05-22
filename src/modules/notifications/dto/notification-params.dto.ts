import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotificationParamsDto {
  @ApiProperty({ description: 'Internal UUID of the notification' })
  @IsUUID()
  id: string;
}

