import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthRateLimit } from '../../common/guards/rate-limit.decorator.js';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface.js';
import type {
  AuthResult,
  AuthTokens,
  SessionContext,
} from './interfaces/auth-response.interface.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @AuthRateLimit()
  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
  ): Promise<AuthResult> {
    return this.authService.register(dto, sessionContext(request));
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @AuthRateLimit()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request): Promise<AuthResult> {
    return this.authService.login(dto, sessionContext(request));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refresh(dto.refreshToken);
  }

  /** Revokes the session this access token belongs to. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentUser() { sessionId }: AuthenticatedUser): Promise<void> {
    return this.authService.logout(sessionId);
  }

  /** Revokes every session of the user (all devices). */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  logoutAll(@CurrentUser() { userId }: AuthenticatedUser): Promise<void> {
    return this.authService.logoutAll(userId);
  }
}

/** Device details stored with the session, useful when reviewing or revoking logins. */
function sessionContext(request: Request): SessionContext {
  return {
    userAgent: request.headers['user-agent']?.slice(0, 512),
    ipAddress: request.ip,
  };
}
