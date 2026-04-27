import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from '@/modules/users/users.service';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { UpsertUserDto } from '@/modules/users/dto/upsert-user.dto';
import { DeleteUserParamsDto } from '@/modules/users/dto/delete-user-params.dto';

@Controller('users')
@UseGuards(TenantGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  upsert(@GetTenant() tenant: any, @Body() dto: UpsertUserDto) {
    return this.usersService.upsert(tenant.id, dto);
  }

  @Delete(':externalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetTenant() tenant: any, @Param() params: DeleteUserParamsDto) {
    await this.usersService.deleteByExternalId(tenant.id, params.externalId);
  }
}

