import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateBannedWordDto {
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    word: string;
}
