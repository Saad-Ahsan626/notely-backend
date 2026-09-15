import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { ValidationException } from '../validation/validation.exception.js';
import { mapException } from './exception-mapping.js';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Database error', {
    code,
    clientVersion: '7.10.0',
  });
}

describe('mapException', () => {
  it('maps validation failures to 400 with details', () => {
    const details = [{ field: 'title', message: 'title must be a string' }];

    expect(mapException(new ValidationException(details))).toEqual({
      status: 400,
      message: 'Validation failed',
      details,
    });
  });

  it('keeps the status and message of Nest HTTP exceptions', () => {
    expect(mapException(new NotFoundException('Note not found'))).toEqual({
      status: 404,
      message: 'Note not found',
    });
    expect(
      mapException(new ServiceUnavailableException('Database is unavailable')),
    ).toEqual({ status: 503, message: 'Database is unavailable' });
  });

  it('joins array messages from built-in exceptions', () => {
    const exception = new BadRequestException({ message: ['first', 'second'] });

    expect(mapException(exception)).toEqual({
      status: 400,
      message: 'first; second',
    });
  });

  it('maps oversized bodies to 413', () => {
    const error = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
      status: 413,
    });

    expect(mapException(error)).toEqual({
      status: 413,
      message: 'Payload too large',
    });
  });

  it.each([
    ['P2002', 409, 'Resource already exists'],
    ['P2003', 409, 'Related resource constraint failed'],
    ['P2025', 404, 'Resource not found'],
  ])('maps Prisma %s to %s', (code, status, message) => {
    expect(mapException(prismaError(code))).toEqual({ status, message });
  });

  it('hides unmapped Prisma errors behind a generic 500', () => {
    expect(mapException(prismaError('P1001'))).toEqual({
      status: 500,
      message: 'Internal server error',
    });
  });

  it('never exposes internal details of unexpected errors', () => {
    const result = mapException(
      new Error(
        'ER_ACCESS_DENIED: SELECT * FROM users WHERE password_hash = ...',
      ),
    );

    expect(result).toEqual({ status: 500, message: 'Internal server error' });
  });

  it('handles thrown non-Error values', () => {
    expect(mapException('just a string')).toEqual({
      status: 500,
      message: 'Internal server error',
    });
  });
});
