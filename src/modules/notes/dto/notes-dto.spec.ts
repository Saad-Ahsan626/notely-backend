import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateNoteDto } from './create-note.dto.js';
import { ListNotesQueryDto } from './list-notes-query.dto.js';
import { UpdateNoteDto } from './update-note.dto.js';

/** Mirrors the global ValidationPipe: transform, then validate with the whitelist. */
async function check<T extends object>(
  type: new () => T,
  plain: Record<string, unknown>,
): Promise<{ value: T; failedFields: string[] }> {
  const value = plainToInstance(type, plain);
  const errors = await validate(value, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  return { value, failedFields: errors.map((error) => error.property) };
}

describe('CreateNoteDto', () => {
  it('accepts a title on its own', async () => {
    const { failedFields } = await check(CreateNoteDto, { title: 'Groceries' });

    expect(failedFields).toEqual([]);
  });

  it('trims the title and rejects one that is only whitespace', async () => {
    const trimmed = await check(CreateNoteDto, { title: '  Groceries  ' });
    const blank = await check(CreateNoteDto, { title: '   ' });

    expect(trimmed.value.title).toBe('Groceries');
    expect(blank.failedFields).toEqual(['title']);
  });

  it('enforces the title and content length limits', async () => {
    const { failedFields } = await check(CreateNoteDto, {
      title: 'x'.repeat(256),
      content: 'y'.repeat(50_001),
    });

    expect(failedFields).toEqual(['title', 'content']);
  });

  it('rejects null for optional fields instead of skipping validation', async () => {
    const { failedFields } = await check(CreateNoteDto, {
      title: 'Groceries',
      content: null,
      isPinned: null,
    });

    expect(failedFields).toEqual(['content', 'isPinned']);
  });

  it('rejects a userId sent by the client', async () => {
    const { failedFields } = await check(CreateNoteDto, {
      title: 'Groceries',
      userId: 'someone-else',
    });

    expect(failedFields).toEqual(['userId']);
  });
});

describe('UpdateNoteDto', () => {
  it('accepts any single field', async () => {
    const { failedFields } = await check(UpdateNoteDto, { isArchived: true });

    expect(failedFields).toEqual([]);
  });

  it('accepts an empty string as content', async () => {
    const { failedFields } = await check(UpdateNoteDto, { content: '' });

    expect(failedFields).toEqual([]);
  });

  it('rejects null values (the NOT NULL columns would fail with a 500)', async () => {
    const { failedFields } = await check(UpdateNoteDto, {
      title: null,
      content: null,
      isPinned: null,
      isArchived: null,
    });

    expect(failedFields).toEqual([
      'title',
      'content',
      'isPinned',
      'isArchived',
    ]);
  });

  it('rejects a non-boolean pin flag', async () => {
    const { failedFields } = await check(UpdateNoteDto, { isPinned: 'yes' });

    expect(failedFields).toEqual(['isPinned']);
  });
});

describe('ListNotesQueryDto', () => {
  it('applies defaults', async () => {
    const { value, failedFields } = await check(ListNotesQueryDto, {});

    expect(failedFields).toEqual([]);
    expect(value).toMatchObject({
      page: 1,
      limit: 20,
      isArchived: false,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });
    expect(value.isPinned).toBeUndefined();
  });

  it('converts numeric strings from the query string', async () => {
    const { value } = await check(ListNotesQueryDto, {
      page: '3',
      limit: '50',
    });

    expect(value.page).toBe(3);
    expect(value.limit).toBe(50);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])(
    'parses isPinned=%s as %s (not Boolean("false"))',
    async (raw, expected) => {
      const { value, failedFields } = await check(ListNotesQueryDto, {
        isPinned: raw,
      });

      expect(failedFields).toEqual([]);
      expect(value.isPinned).toBe(expected);
    },
  );

  it.each(['yes', '1', 'TRUE', ''])('rejects isPinned=%s', async (raw) => {
    const { failedFields } = await check(ListNotesQueryDto, { isPinned: raw });

    expect(failedFields).toEqual(['isPinned']);
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ page: 'abc' }, 'page'],
    [{ limit: '101' }, 'limit'],
    [{ limit: '0' }, 'limit'],
    [{ sortBy: 'password' }, 'sortBy'],
    [{ sortOrder: 'sideways' }, 'sortOrder'],
    [{ search: 'x'.repeat(101) }, 'search'],
  ])('rejects %o', async (plain, field) => {
    const { failedFields } = await check(ListNotesQueryDto, plain);

    expect(failedFields).toEqual([field]);
  });

  it('treats a blank search as no search', async () => {
    const { value } = await check(ListNotesQueryDto, { search: '   ' });

    expect(value.search).toBeUndefined();
  });

  it('trims the search term', async () => {
    const { value } = await check(ListNotesQueryDto, { search: '  milk ' });

    expect(value.search).toBe('milk');
  });
});
