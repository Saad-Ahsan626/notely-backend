import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

export interface MappedPrismaError {
  status: HttpStatus;
  message: string;
}

/**
 * Safety net for database errors a service did not handle explicitly.
 * Services should still throw meaningful exceptions for expected cases
 * (e.g. "Email is already registered"); this only prevents a generic 500.
 *
 * @see https://www.prisma.io/docs/orm/reference/error-reference
 */
export function mapPrismaError(error: unknown): MappedPrismaError | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return undefined;
  }

  switch (error.code) {
    case 'P2002': // Unique constraint failed
      return {
        status: HttpStatus.CONFLICT,
        message: 'Resource already exists',
      };
    case 'P2003': // Foreign key constraint failed
      return {
        status: HttpStatus.CONFLICT,
        message: 'Related resource constraint failed',
      };
    case 'P2025': // Required record not found
      return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' };
    default:
      return undefined;
  }
}
