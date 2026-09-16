/** Identity attached to every authenticated request by the JWT guard. */
export interface AuthenticatedUser {
  userId: string;
  /** The login session this token belongs to, so logout can target one device */
  sessionId: string;
}

/** Claims carried by an access token. */
export interface JwtPayload {
  /** Subject: the user ID */
  sub: string;
  /** Session ID */
  sid: string;
  iat: number;
  exp: number;
}
