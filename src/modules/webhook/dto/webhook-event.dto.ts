import { ApiProperty } from '@nestjs/swagger';

/** A `WebhookEvent` outbox row. */
export class WebhookEventDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'comment.moderated' }) event: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Canonical payload delivered to the tenant',
  })
  payload: Record<string, unknown>;
  @ApiProperty() tenantId: string;
  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'Set once delivered',
  })
  sentAt: Date | null;
  @ApiProperty() attempts: number;
  @ApiProperty({ type: String, nullable: true }) lastError: string | null;
  @ApiProperty({
    type: Date,
    nullable: true,
    description:
      'Next scheduled attempt; null when delivered, due now, or dead-lettered',
  })
  nextRetryAt: Date | null;
  @ApiProperty({
    description:
      'Max attempts reached: never retried again until a manual resend',
  })
  deadLettered: boolean;
  @ApiProperty() createdAt: Date;
}

export class WebhookResendAllResultDto {
  @ApiProperty({
    description: 'Number of undelivered events reset',
    example: 12,
  })
  reset: number;
}
