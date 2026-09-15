import { HttpException, HttpStatus } from '@nestjs/common';
import { mapPrismaError } from '../../database/prisma-errors.js';
import type { ValidationErrorDetail } from '../validation/validation.exception.js';
import { ValidationException } from '../validation/validation.exception.js';

export interface MappedException {
  status: number;
  message: string;
  details?: ValidationErrorDetail[];
}

/**
 * Errors raised by Express' body parser before a request reaches Nest (http-errors objects).
 * Malformed JSON never arrives here: Nest's Express adapter already converts the parser's
 * SyntaxError into a BadRequestException, which is handled like any other HttpException.
 */
interface BodyParserError {
  type: string;
  status: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof Reflect.get(error, 'type') === 'string' &&
    typeof Reflect.get(error, 'status') === 'number'
  );
}

function messageFromHttpException(exception: HttpException): string {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return response;
  }

  const message: unknown = Reflect.get(response, 'message');
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message)) {
    return message.map(String).join('; ');
  }
  return exception.message;
}

/**
 * Decides what the client is told about an error. Anything unrecognized becomes a
 * generic 500: internal messages, SQL and stack traces must never reach the client.
 */
export function mapException(exception: unknown): MappedException {
  if (exception instanceof ValidationException) {
    return {
      status: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      details: exception.details,
    };
  }

  if (exception instanceof HttpException) {
    return {
      status: exception.getStatus(),
      message: messageFromHttpException(exception),
    };
  }

  if (isBodyParserError(exception) && exception.type === 'entity.too.large') {
    return {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'Payload too large',
    };
  }

  const prismaError = mapPrismaError(exception);
  if (prismaError) {
    return prismaError;
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  };
}
