import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsEmail()
  @MaxLength(255)
  // Stored and looked up lowercase, so Alex@Mail.com and alex@mail.com are one account
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  // Length over complexity (NIST 800-63B): no forced character classes
  @IsString()
  @Length(8, 128)
  password: string;
}
