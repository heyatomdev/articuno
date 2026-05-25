import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WebhookEventParamsDto {
  @ApiProperty({ description: 'Internal UUID of the webhook event' })
  @IsUUID()
  id: string;
}

