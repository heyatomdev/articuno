import { IsUUID } from 'class-validator';

export class ReportParamsDto {
  @IsUUID()
  id: string;
}

