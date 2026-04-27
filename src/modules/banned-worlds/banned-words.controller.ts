import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { BannedWordsService } from './banned-words.service';
import { CreateBannedWordDto } from './dto/create-banned-word.dto';
import {TenantGuard} from "@/modules/tenants/guards/tenant.guard";
import {GetTenant} from "@/modules/tenants/decorators/get-tenant.decorator";

@Controller('banned-words')
@UseGuards(TenantGuard)
export class BannedWordsController {
    constructor(private readonly bannedWordsService: BannedWordsService) {}

    @Post()
    create(@GetTenant() tenant: any, @Body() dto: CreateBannedWordDto) {
        return this.bannedWordsService.create(tenant.id, dto);
    }

    @Get()
    findAll(@GetTenant() tenant: any) {
        return this.bannedWordsService.findAll(tenant.id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @GetTenant() tenant: any) {
        return this.bannedWordsService.remove(id, tenant.id);
    }
}
