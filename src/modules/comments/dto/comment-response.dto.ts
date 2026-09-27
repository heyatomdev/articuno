import { ContentStatus, UserRole, UserStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '@/modules/users/dto/user.dto';

// Response shapes of CommentsService, mirroring its Prisma `include` clauses.

class CommentBaseDto {
  @ApiProperty() id: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null on the public API while the comment is not VISIBLE',
  })
  content: string | null;
  @ApiProperty({ description: 'Internal UUID of the author' }) authorId: string;
  @ApiProperty() articleId: string;
  @ApiProperty() tenantId: string;
  @ApiProperty({ enum: ContentStatus, enumName: 'ContentStatus' })
  status: ContentStatus;
  @ApiProperty() reportCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

/** A single comment, with its full author row. */
export class CommentDto extends CommentBaseDto {
  @ApiProperty({ type: UserDto }) author: UserDto;
}

export class CommentTenantSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class CommentAuthorSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' }) status: UserStatus;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' }) role: UserRole;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: String, nullable: true }) username: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarUrl: string | null;
}

/** A comment in a list. */
export class CommentListItemDto extends CommentBaseDto {
  @ApiProperty({ type: CommentTenantSummaryDto })
  tenant: CommentTenantSummaryDto;
  @ApiProperty({ type: CommentAuthorSummaryDto })
  author: CommentAuthorSummaryDto;
}
