import {
  ContentStatus,
  ReportStatus,
  TargetType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportUserSummaryDto {
  @ApiProperty() externalId: string;
  @ApiProperty({ type: String, nullable: true }) username: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarUrl: string | null;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' }) role: UserRole;
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' }) status: UserStatus;
}

/** The resolved target of a report (see `ReportsService.withTargets`). */
export class ReportTargetDto {
  @ApiProperty() id: string;
  @ApiProperty({
    description: 'Article title, one-line comment preview, or username',
  })
  label: string;
  @ApiProperty({
    type: String,
    nullable: true,
    enum: [
      ...new Set([
        ...Object.values(ContentStatus),
        ...Object.values(UserStatus),
      ]),
    ],
    description: 'Status of the target; null when it no longer exists',
  })
  status: ContentStatus | UserStatus | null;
  @ApiPropertyOptional({ description: 'Only for COMMENT targets' })
  articleId?: string;
  @ApiPropertyOptional({
    description: 'True when the target id resolved to nothing',
  })
  missing?: boolean;
}

export class ReportDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'SPAM' }) reason: string;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ enum: ReportStatus, enumName: 'ReportStatus' })
  status: ReportStatus;
  @ApiProperty({ enum: TargetType, enumName: 'TargetType' })
  targetType: TargetType;
  @ApiProperty() targetId: string;
  @ApiProperty({ description: 'External ID of the reporter' })
  reporterId: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'External ID of the moderator',
  })
  moderatorId: string | null;
  @ApiProperty({ type: String, nullable: true }) moderatorNote: string | null;
  @ApiProperty() tenantId: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: ReportUserSummaryDto }) reporter: ReportUserSummaryDto;
  @ApiProperty({ type: ReportUserSummaryDto, nullable: true })
  moderator: ReportUserSummaryDto | null;
  @ApiProperty({ type: ReportTargetDto }) target: ReportTargetDto;
}
