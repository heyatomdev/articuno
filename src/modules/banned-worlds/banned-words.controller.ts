import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import { BannedWordsService } from './banned-words.service';
import { CreateBannedWordDto } from './dto/create-banned-word.dto';
import {TenantGuard} from "@/modules/tenants/guards/tenant.guard";
import {GetTenant} from "@/modules/tenants/decorators/get-tenant.decorator";
import { BannedWordListQueryDto } from './dto/banned-word-list-query.dto';
import { PagedResponse } from '@/pagination';
import { BannedWordDto } from './dto/banned-word.dto';

@Controller('banned-words')
@UseGuards(TenantGuard)
export class BannedWordsController {
    constructor(private readonly bannedWordsService: BannedWordsService) {}

    @Post()
    create(@GetTenant() tenant: any, @Body() dto: CreateBannedWordDto) {
        return this.bannedWordsService.create(tenant.id, dto);
    }

    @Get()
    findAll(
        @GetTenant() tenant: any,
        @Query(new ValidationPipe({ transform: true })) filters: BannedWordListQueryDto,
    ): Promise<PagedResponse<BannedWordDto>> {
        return this.bannedWordsService.findAll(tenant.id, filters);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @GetTenant() tenant: any) {
        return this.bannedWordsService.remove(id, tenant.id);
    }
}
