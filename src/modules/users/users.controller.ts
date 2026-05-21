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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from '@/modules/users/users.service';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { UpsertUserDto } from '@/modules/users/dto/upsert-user.dto';
import { DeleteUserParamsDto } from '@/modules/users/dto/delete-user-params.dto';

@ApiTags('Users')
@ApiSecurity('api-key')
@Controller('users')
@UseGuards(TenantGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  @ApiOperation({
    summary: 'Sync (upsert) a user',
    description: 'Creates or updates a user record for the current tenant based on their external ID. Use this endpoint to keep the CMS user data in sync with your identity provider.',
  })
  @ApiBody({ type: UpsertUserDto })
  @ApiResponse({ status: 201, description: 'User created or updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  upsert(@GetTenant() tenant: any, @Body() dto: UpsertUserDto) {
    return this.usersService.upsert(tenant.id, dto);
  }

  @Delete(':externalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Permanently deletes a user record identified by their external ID. All associated content (articles, comments, interactions) may be affected depending on tenant configuration.',
  })
  @ApiParam({ name: 'externalId', description: 'External ID of the user to delete', example: 'user_abc123' })
  @ApiResponse({ status: 204, description: 'User deleted successfully – no content returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async remove(@GetTenant() tenant: any, @Param() params: DeleteUserParamsDto) {
    await this.usersService.deleteByExternalId(tenant.id, params.externalId);
  }
}

