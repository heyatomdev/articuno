import { IsUUID } from 'class-validator';

export class TagParamsDto {
  @IsUUID()
  id: string;
}

