import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditsService } from '@/modules/audits/audits.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { AuditListQueryDto } from '@/modules/audits/dto/audit-list-query.dto';

@Controller('admin/audits')
@UseGuards(SessionGuard)
export class AdminAuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Get()
  findAll(
    @GetSession() session: any,
    @Query() query: AuditListQueryDto,
  ) {
    return this.auditsService.findAll(session.tenantId, query);
  }

  @Get(':id')
  findOne(
    @GetSession() session: any,
    @Param('id') id: string,
  ) {
    return this.auditsService.findOne(id, session.tenantId);
  }
}

