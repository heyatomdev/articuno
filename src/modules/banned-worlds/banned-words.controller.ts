import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiSecurity,
    ApiParam,
    ApiBody,
} from '@nestjs/swagger';
import { BannedWordsService } from './banned-words.service';
import { CreateBannedWordDto } from './dto/create-banned-word.dto';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { BannedWordListQueryDto } from './dto/banned-word-list-query.dto';
import { PagedResponse } from '@/pagination';
import { BannedWordDto } from './dto/banned-word.dto';

@ApiTags('Banned Words')
@ApiSecurity('x-api-key')
@Controller('banned-words')
@UseGuards(TenantGuard)
export class BannedWordsController {
    constructor(private readonly bannedWordsService: BannedWordsService) {}

    @Post()
    @ApiOperation({
        summary: 'Add a banned word',
        description:
            'Adds a new word to the tenant\'s banned word list. ' +
            'Any content containing this word will be automatically hidden during creation or moderation checks.',
    })
    @ApiBody({ type: CreateBannedWordDto })
    @ApiResponse({ status: 201, description: 'Banned word added successfully.', type: BannedWordDto })
    @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
    @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
    @ApiResponse({ status: 409, description: 'This word is already in the banned word list.' })
    create(@GetTenant() tenant: any, @Body() dto: CreateBannedWordDto) {
        return this.bannedWordsService.create(tenant.id, dto);
    }

    @Get()
    @ApiOperation({
        summary: 'List banned words',
        description: 'Returns a paginated list of banned words for the current tenant.',
    })
    @ApiResponse({ status: 200, description: 'Paginated list of banned words.', type: BannedWordDto, isArray: true })
    @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
    findAll(
        @GetTenant() tenant: any,
        @Query(new ValidationPipe({ transform: true })) filters: BannedWordListQueryDto,
    ): Promise<PagedResponse<BannedWordDto>> {
        return this.bannedWordsService.findAll(tenant.id, filters);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Remove a banned word',
        description: 'Permanently removes a word from the tenant\'s banned word list.',
    })
    @ApiParam({
        name: 'id',
        description: 'UUID of the banned word entry to remove',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({ status: 204, description: 'Banned word removed successfully – no content returned.' })
    @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
    @ApiResponse({ status: 404, description: 'Banned word not found.' })
    remove(@Param('id') id: string, @GetTenant() tenant: any) {
        return this.bannedWordsService.remove(id, tenant.id);
    }
}
