import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:public';

/**
 * Opts a route out of the global authentication guard.
 * Everything else requires a valid access token (secure by default).
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
