import { ApiProperty } from '@nestjs/swagger';

export class NotificationUserSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() externalId: string;
  @ApiProperty({ type: String, nullable: true }) username: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarUrl: string | null;
}

/** A `Notification` row with its user. */
export class NotificationDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'comment.moderated' }) type: string;
  @ApiProperty() title: string;
  @ApiProperty() message: string;
  @ApiProperty() userId: string;
  @ApiProperty() tenantId: string;
  @ApiProperty() sentToClient: boolean;
  @ApiProperty({ type: Date, nullable: true }) readAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: NotificationUserSummaryDto })
  user: NotificationUserSummaryDto;
}
