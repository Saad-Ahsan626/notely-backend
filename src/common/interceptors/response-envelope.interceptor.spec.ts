import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { PaginatedResult } from '../dto/paginated-result.js';
import {
  ResponseEnvelopeInterceptor,
  toEnvelope,
} from './response-envelope.interceptor.js';

describe('toEnvelope', () => {
  it('wraps a resource in { data }', () => {
    expect(toEnvelope({ id: '1', title: 'Note' })).toEqual({
      data: { id: '1', title: 'Note' },
    });
  });

  it('wraps arrays and null as data', () => {
    expect(toEnvelope([1, 2])).toEqual({ data: [1, 2] });
    expect(toEnvelope(null)).toEqual({ data: null });
  });

  it('renders a PaginatedResult as { data, meta } without double wrapping', () => {
    const result = new PaginatedResult(['a', 'b'], {
      page: 2,
      limit: 2,
      total: 5,
    });

    expect(toEnvelope(result)).toEqual({
      data: ['a', 'b'],
      meta: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
  });

  it('leaves empty responses and file streams untouched', () => {
    const file = new StreamableFile(Buffer.from('x'));

    expect(toEnvelope(undefined)).toBeUndefined();
    expect(toEnvelope(file)).toBe(file);
  });
});

const handler = (value: unknown): CallHandler => ({
  handle: () => of(value),
});

describe('ResponseEnvelopeInterceptor', () => {
  const reflector = new Reflector();
  const interceptor = new ResponseEnvelopeInterceptor(reflector);

  function contextWith(skip: boolean | undefined): ExecutionContext {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(skip);
    return {
      getType: () => 'http',
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps the handler result', async () => {
    const result = interceptor.intercept(
      contextWith(undefined),
      handler({ id: '1' }),
    );

    await expect(firstValueFrom(result)).resolves.toEqual({
      data: { id: '1' },
    });
  });

  it('returns the raw value for routes marked with @SkipEnvelope()', async () => {
    const result = interceptor.intercept(
      contextWith(true),
      handler({ status: 'ok' }),
    );

    await expect(firstValueFrom(result)).resolves.toEqual({ status: 'ok' });
  });
});

describe('PaginatedResult', () => {
  it.each([
    [0, 20, 0],
    [1, 20, 1],
    [20, 20, 1],
    [21, 20, 2],
  ])('total %s with limit %s has %s pages', (total, limit, totalPages) => {
    expect(
      new PaginatedResult([], { page: 1, limit, total }).meta.totalPages,
    ).toBe(totalPages);
  });
});
