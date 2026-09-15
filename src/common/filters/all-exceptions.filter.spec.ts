import type { ArgumentsHost } from '@nestjs/common';
import { Logger, NotFoundException } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import type { ErrorResponse } from './error-response.interface.js';

describe('AllExceptionsFilter', () => {
  const httpAdapter = {
    reply: vi.fn<(response: unknown, body: unknown, status: number) => void>(),
    setHeader:
      vi.fn<(response: unknown, name: string, value: string) => void>(),
    isHeadersSent: vi.fn<(response: unknown) => boolean>(() => false),
  };
  const filter = new AllExceptionsFilter({
    httpAdapter,
  } as unknown as HttpAdapterHost);
  const response = {};

  function hostFor(request: object): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
  }

  function sentBody(): ErrorResponse {
    return httpAdapter.reply.mock.calls[0]?.[1] as ErrorResponse;
  }

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders the standard error shape with the request ID', () => {
    const request = {
      id: 'req-123',
      originalUrl: '/api/v1/notes/42?token=secret',
      headers: {},
    };

    filter.catch(new NotFoundException('Note not found'), hostFor(request));

    expect(httpAdapter.reply).toHaveBeenCalledWith(
      response,
      expect.any(Object),
      404,
    );
    expect(sentBody()).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Note not found',
      path: '/api/v1/notes/42',
      timestamp: expect.any(String),
      requestId: 'req-123',
    });
  });

  it('does not echo the query string in the path', () => {
    filter.catch(
      new NotFoundException(),
      hostFor({
        id: 'r',
        originalUrl: '/api/v1/x?password=hunter2',
        headers: {},
      }),
    );

    expect(JSON.stringify(sentBody())).not.toContain('hunter2');
  });

  it('logs unexpected errors with their details but hides them from the client', () => {
    const error = new Error('connection string mysql://root:pw@db leaked');

    filter.catch(
      error,
      hostFor({ id: 'r', originalUrl: '/api/v1/x', headers: {} }),
    );

    expect(Logger.prototype.error).toHaveBeenCalledWith(error);
    expect(sentBody().statusCode).toBe(500);
    expect(sentBody().message).toBe('Internal server error');
    expect(JSON.stringify(sentBody())).not.toContain('mysql://');
  });

  it('does not log client errors (the HTTP logger already records them)', () => {
    filter.catch(
      new NotFoundException(),
      hostFor({ id: 'r', originalUrl: '/api/v1/x', headers: {} }),
    );

    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it('creates a request ID and header when the HTTP logger has not assigned one yet', () => {
    filter.catch(
      new NotFoundException(),
      hostFor({
        originalUrl: '/api/v1/x',
        headers: { 'x-request-id': 'client-id-1' },
      }),
    );

    expect(sentBody().requestId).toBe('client-id-1');
    expect(httpAdapter.setHeader).toHaveBeenCalledWith(
      response,
      'X-Request-Id',
      'client-id-1',
    );
  });

  it('does nothing when the response has already been sent', () => {
    httpAdapter.isHeadersSent.mockReturnValueOnce(true);

    filter.catch(
      new Error('late'),
      hostFor({ id: 'r', url: '/', headers: {} }),
    );

    expect(httpAdapter.reply).not.toHaveBeenCalled();
  });
});
