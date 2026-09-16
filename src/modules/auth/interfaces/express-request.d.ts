import type { AuthenticatedUser } from './authenticated-user.interface.js';

// Lets `request.user` be typed without casting in guards and decorators
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
