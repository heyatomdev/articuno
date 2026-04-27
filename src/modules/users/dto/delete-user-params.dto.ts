import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteUserParamsDto {
  @IsString()
  @IsNotEmpty()
  externalId: string;
}

