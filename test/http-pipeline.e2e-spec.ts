import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import request from 'supertest';
import { PaginatedResult } from '../src/common/dto/paginated-result.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { createTestApp } from './utils/create-test-app.js';

// --- Test harness: a controller that exists only in this test ---------------------------

class TagDto {
  @IsString()
  @Length(1, 10)
  name: string;
}

class CreateItemDto {
  @IsString()
  @Length(1, 20)
  title: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TagDto)
  tag?: TagDto;
}

class ListItemsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
}

@Controller('test-harness')
class HarnessController {
  @Post('items')
  create(@Body() dto: CreateItemDto) {
    return {
      title: dto.title,
      receivedDtoInstance: dto instanceof CreateItemDto,
    };
  }

  @Get('items')
  list(@Query() query: ListItemsQueryDto) {
    return new PaginatedResult([{ pageType: typeof query.page }], {
      page: query.page,
      limit: 10,
      total: 25,
    });
  }

  @Delete('items')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(): void {}

  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('Item not found');
  }

  @Get('duplicate')
  duplicate(): never {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.10.0',
    });
  }

  @Get('crash')
  crash(): never {
    throw new Error('SELECT password_hash FROM users -- internal detail');
  }
}

// --- Tests ---------------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('HTTP pipeline (e2e)', () => {
  let app: NestExpressApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp([HarnessController]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('success envelope', () => {
    it('wraps a resource in { data }', async () => {
      const response = await api()
        .post('/api/v1/test-harness/items')
        .send({ title: 'Groceries' })
        .expect(201);

      expect(response.body).toEqual({
        data: { title: 'Groceries', receivedDtoInstance: true },
      });
    });

    it('returns lists as { data, meta } with query params converted to numbers', async () => {
      const response = await api()
        .get('/api/v1/test-harness/items?page=2')
        .expect(200);

      expect(response.body).toEqual({
        data: [{ pageType: 'number' }],
        meta: { page: 2, limit: 10, total: 25, totalPages: 3 },
      });
    });

    it('sends 204 responses without a body', async () => {
      const response = await api()
        .delete('/api/v1/test-harness/items')
        .expect(204);

      expect(response.text).toBe('');
    });
  });

  describe('validation', () => {
    it('rejects invalid input with field-level details', async () => {
      const response = await api()
        .post('/api/v1/test-harness/items')
        .send({ title: '', tag: { name: 'this-name-is-too-long' } })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        path: '/api/v1/test-harness/items',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          { field: 'title', message: expect.stringContaining('title') },
          { field: 'tag.name', message: expect.stringContaining('name') },
        ]),
      );
    });

    it('rejects unknown properties (mass assignment protection)', async () => {
      const response = await api()
        .post('/api/v1/test-harness/items')
        .send({ title: 'Valid', userId: 'someone-else' })
        .expect(400);

      expect(response.body.details).toEqual([
        { field: 'userId', message: 'property userId should not exist' },
      ]);
    });

    it('rejects query params that fail validation', async () => {
      const response = await api()
        .get('/api/v1/test-harness/items?page=0')
        .expect(400);

      expect(response.body.details).toEqual([
        { field: 'page', message: 'page must not be less than 1' },
      ]);
    });
  });

  describe('error format', () => {
    it('renders HTTP exceptions in the standard shape', async () => {
      const response = await api()
        .get('/api/v1/test-harness/not-found')
        .expect(404);

      expect(response.body).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Item not found',
        path: '/api/v1/test-harness/not-found',
        timestamp: expect.any(String),
        requestId: expect.stringMatching(UUID),
      });
    });

    it('renders unknown routes in the standard shape', async () => {
      const response = await api().get('/api/v1/does-not-exist').expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
      });
    });

    it('maps unhandled database unique violations to 409', async () => {
      const response = await api()
        .get('/api/v1/test-harness/duplicate')
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        message: 'Resource already exists',
      });
    });

    it('hides internal details of unexpected errors', async () => {
      const response = await api()
        .get('/api/v1/test-harness/crash')
        .expect(500);

      expect(response.body).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /password_hash|SELECT|stack/,
      );
    });

    it('rejects malformed JSON with 400 in the standard shape', async () => {
      const response = await api()
        .post('/api/v1/test-harness/items')
        .set('Content-Type', 'application/json')
        .send('{"title": ')
        .expect(400);

      // Nest's Express adapter turns the JSON parser's SyntaxError into a BadRequestException
      expect(response.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: expect.stringContaining('JSON'),
        path: '/api/v1/test-harness/items',
        timestamp: expect.any(String),
        requestId: expect.any(String),
      });
    });

    it('rejects bodies over the size limit with 413', async () => {
      const response = await api()
        .post('/api/v1/test-harness/items')
        .send({ title: 'x', padding: 'a'.repeat(300 * 1024) })
        .expect(413);

      expect(response.body).toMatchObject({
        statusCode: 413,
        message: 'Payload too large',
      });
    });
  });

  describe('request IDs', () => {
    it('returns a generated request ID header that matches the error body', async () => {
      const response = await api().get('/api/v1/test-harness/not-found');

      expect(response.headers['x-request-id']).toMatch(UUID);
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
    });

    it('reuses a well-formed client request ID', async () => {
      const response = await api()
        .get('/api/v1/test-harness/not-found')
        .set('X-Request-Id', 'flutter-req-42');

      expect(response.headers['x-request-id']).toBe('flutter-req-42');
      expect(response.body.requestId).toBe('flutter-req-42');
    });

    it('replaces an unsafe client request ID', async () => {
      const response = await api()
        .get('/api/v1/health')
        .set('X-Request-Id', 'bad id with spaces');

      expect(response.headers['x-request-id']).toMatch(UUID);
    });
  });

  describe('security headers and CORS', () => {
    it('sets security headers and hides the framework', async () => {
      const response = await api().get('/api/v1/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('allows configured browser origins and exposes the request ID header', async () => {
      const response = await api()
        .get('/api/v1/health')
        .set('Origin', 'http://allowed.test');

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://allowed.test',
      );
      expect(response.headers['access-control-expose-headers']).toContain(
        'X-Request-Id',
      );
    });

    it('does not allow other browser origins', async () => {
      const response = await api()
        .get('/api/v1/health')
        .set('Origin', 'http://evil.test');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
