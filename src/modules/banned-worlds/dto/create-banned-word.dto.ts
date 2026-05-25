import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBannedWordDto {
    @ApiProperty({
        description: 'The word to add to the banned word list (2–50 characters)',
        example: 'spam',
        minLength: 2,
        maxLength: 50,
    })
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    word: string;
}
