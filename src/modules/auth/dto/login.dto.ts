import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;
}
