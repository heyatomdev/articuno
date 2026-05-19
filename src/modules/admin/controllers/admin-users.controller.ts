import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from '@/modules/users/users.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { UserListQueryDto } from '@/modules/users/dto/user-list-query.dto';
import { UserListItemDto } from '@/modules/users/dto/user-list-item.dto';
import { UserParamsDto } from '@/modules/users/dto/user-params.dto';
import { PagedResponse } from '@/pagination';

@Controller('admin/users')
@UseGuards(SessionGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(
    @GetSession() session: any,
    @Query() query: UserListQueryDto,
  ): Promise<PagedResponse<UserListItemDto>> {
    return this.usersService.findAll(session.tenantId, query);
  }

  @Get(':id')
  findOne(
    @GetSession() session: any,
    @Param() params: UserParamsDto,
  ): Promise<UserListItemDto> {
    return this.usersService.findOne(session.tenantId, params.id);
  }
}

