import { IsUUID } from 'class-validator';

export class UserParamsDto {
  @IsUUID()
  id: string;
}

