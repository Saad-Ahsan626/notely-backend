import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request, Response } from 'express';
import { REQUEST_ID_HEADER, resolveRequestId } from '../http/request-id.js';
import type { ErrorResponse } from './error-response.interface.js';
import { mapException } from './exception-mapping.js';

/** Statuses from here up are server failures and are logged with full details. */
const SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

/**
 * Catches every exception and renders the API's single error format.
 * Details of unexpected errors go to the logs, never to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const { status, message, details } = mapException(exception);

    if (status >= SERVER_ERROR_STATUS) {
      // 4xx responses are already logged as warnings by the HTTP logger
      this.logger.error(exception);
    }

    if (httpAdapter.isHeadersSent(response)) {
      return;
    }

    const body: ErrorResponse = {
      statusCode: status,
      error: STATUS_CODES[status] ?? 'Error',
      message,
      ...(details && { details }),
      // Path only: query strings can contain data that must not be echoed back
      path: (request.originalUrl ?? request.url).split('?')[0] ?? '/',
      timestamp: new Date().toISOString(),
      requestId: this.getRequestId(request, response),
    };

    httpAdapter.reply(response, body, status);
  }

  /**
   * The HTTP logger assigns `request.id`. Errors raised before it runs (such as a malformed
   * JSON body) have no ID yet, so one is created here and sent in the response header too.
   */
  private getRequestId(request: Request, response: Response): string {
    const assigned: unknown = Reflect.get(request, 'id');
    if (typeof assigned === 'string') {
      return assigned;
    }

    const requestId = resolveRequestId(request.headers['x-request-id']);
    this.httpAdapterHost.httpAdapter.setHeader(
      response,
      REQUEST_ID_HEADER,
      requestId,
    );
    return requestId;
  }
}
