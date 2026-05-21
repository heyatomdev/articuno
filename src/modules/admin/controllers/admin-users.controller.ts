import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from '@/modules/users/users.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { UserListQueryDto } from '@/modules/users/dto/user-list-query.dto';
import { UserListItemDto } from '@/modules/users/dto/user-list-item.dto';
import { UserParamsDto } from '@/modules/users/dto/user-params.dto';
import { PagedResponse } from '@/pagination';

@ApiTags('Admin / Users')
@ApiCookieAuth('sessionId')
@Controller('admin/users')
@UseGuards(SessionGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List users',
    description: 'Returns a paginated list of all users belonging to the session tenant.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of users.', type: UserListItemDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  findAll(
    @GetSession() session: any,
    @Query() query: UserListQueryDto,
  ): Promise<PagedResponse<UserListItemDto>> {
    return this.usersService.findAll(session.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a user by ID',
    description: 'Returns the full profile of a single user identified by their internal UUID.',
  })
  @ApiParam({ name: 'id', description: 'Internal UUID of the user', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'User found.', type: UserListItemDto })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(
    @GetSession() session: any,
    @Param() params: UserParamsDto,
  ): Promise<UserListItemDto> {
    return this.usersService.findOne(session.tenantId, params.id);
  }
}

