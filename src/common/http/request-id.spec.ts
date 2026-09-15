import { resolveRequestId } from './request-id.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it('reuses a well-formed client request ID', () => {
    expect(resolveRequestId('flutter-app.req_123')).toBe('flutter-app.req_123');
  });

  it('generates a UUID when the header is missing', () => {
    expect(resolveRequestId(undefined)).toMatch(UUID);
  });

  it('uses the first value when the header is sent more than once', () => {
    expect(resolveRequestId(['first-id', 'second-id'])).toBe('first-id');
  });

  it.each([
    ['empty', ''],
    ['spaces', 'bad id'],
    ['line breaks (log injection)', 'abc\n{"level":"error"}'],
    ['too long', 'a'.repeat(65)],
  ])('replaces an unsafe value (%s) with a generated UUID', (_case, value) => {
    expect(resolveRequestId(value)).toMatch(UUID);
  });
});
