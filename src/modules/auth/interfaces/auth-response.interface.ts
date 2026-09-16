import type { UserResponse } from '../../users/dto/user-response.dto.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access token lifetime in seconds */
  expiresIn: number;
}

export interface AuthResult {
  user: UserResponse;
  tokens: AuthTokens;
}

/** Details of the device a session was created from, for the sessions list. */
export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}
