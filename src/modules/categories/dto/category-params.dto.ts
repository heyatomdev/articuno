import { IsUUID } from 'class-validator';

export class CategoryParamsDto {
  @IsUUID()
  id: string;
}

