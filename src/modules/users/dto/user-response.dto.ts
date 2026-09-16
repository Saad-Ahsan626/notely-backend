import type { UserModel } from '../../../generated/prisma/models.js';

/** The only user shape ever sent to clients. */
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Explicit mapping instead of @Exclude(): Prisma returns plain objects, on which
 * class-transformer decorators are silently ignored, which would leak passwordHash.
 */
export function toUserResponse(user: UserModel): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
