import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString} from 'class-validator';
import {PagedQuery} from "@/pagination";

export class TagsListQuery extends PagedQuery {
  @ApiProperty({
    description: 'Tag name',
    required: false
  })
  @IsString()
  @IsOptional()
    name?: string;
}
