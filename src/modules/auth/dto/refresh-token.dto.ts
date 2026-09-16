import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @Length(10, 200)
  refreshToken: string;
}
