import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestApp } from './utils/create-test-app.js';

interface Note {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

describe('Notes (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];
  const api = () => request(app.getHttpServer());

  /** Registers a fresh user and returns an Authorization header value. */
  async function newUser(): Promise<string> {
    const email = `e2e-notes-${randomUUID()}@notely.test`;
    createdEmails.push(email);

    const response = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Notes Tester', email, password: 'CorrectHorseBattery1' })
      .expect(201);

    return `Bearer ${response.body.data.tokens.accessToken}`;
  }

  async function createNote(
    auth: string,
    body: Record<string, unknown> = { title: 'A note' },
  ): Promise<Note> {
    const response = await api()
      .post('/api/v1/notes')
      .set('Authorization', auth)
      .send(body)
      .expect(201);

    return response.body.data;
  }

  async function listNotes(
    auth: string,
    query: Record<string, string | number | boolean> = {},
  ): Promise<{ data: Note[]; meta: Record<string, number> }> {
    const response = await api()
      .get('/api/v1/notes')
      .query(query)
      .set('Authorization', auth)
      .expect(200);

    return response.body;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await app.close();
  });

  describe('create', () => {
    it('creates a note with defaults and a Location header', async () => {
      const auth = await newUser();

      const response = await api()
        .post('/api/v1/notes')
        .set('Authorization', auth)
        .send({ title: '  Groceries  ' })
        .expect(201);

      const note: Note = response.body.data;
      expect(note).toEqual({
        id: expect.any(String),
        title: 'Groceries',
        content: '',
        isPinned: false,
        isArchived: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(response.headers['location']).toBe(`/api/v1/notes/${note.id}`);
    });

    it('builds a clean Location header even with a trailing slash', async () => {
      const auth = await newUser();

      const response = await api()
        .post('/api/v1/notes/')
        .set('Authorization', auth)
        .send({ title: 'Slash' })
        .expect(201);

      expect(response.headers['location']).toBe(
        `/api/v1/notes/${response.body.data.id}`,
      );
    });

    it('never exposes internal fields', async () => {
      const auth = await newUser();

      const note = await createNote(auth);

      expect(note).not.toHaveProperty('userId');
      expect(note).not.toHaveProperty('deletedAt');
    });

    it('stores emoji and exactly the maximum content length', async () => {
      const auth = await newUser();
      // 'Eggs 🥚 ' is 8 UTF-16 code units (the emoji counts as 2)
      const content = `Eggs 🥚 ${'x'.repeat(49_992)}`;
      expect(content).toHaveLength(50_000);

      const note = await createNote(auth, { title: 'Big note 📝', content });

      const fetched = await api()
        .get(`/api/v1/notes/${note.id}`)
        .set('Authorization', auth)
        .expect(200);
      expect(fetched.body.data.title).toBe('Big note 📝');
      expect(fetched.body.data.content).toBe(content);
    });

    it('rejects content one character over the limit', async () => {
      const auth = await newUser();

      const response = await api()
        .post('/api/v1/notes')
        .set('Authorization', auth)
        .send({ title: 'Too long', content: 'x'.repeat(50_001) })
        .expect(400);

      expect(response.body.details).toEqual([
        {
          field: 'content',
          message: 'content must be shorter than or equal to 50000 characters',
        },
      ]);
    });

    it('accepts a maximum-length note sent with escaped non-ASCII JSON', async () => {
      const auth = await newUser();
      // Some JSON encoders write every non-ASCII character as a 6-byte escape sequence
      const escapedBody = JSON.stringify({
        title: 'Escaped',
        content: 'é'.repeat(50_000),
      }).replaceAll('é', String.raw`\u00e9`);
      expect(Buffer.byteLength(escapedBody)).toBeGreaterThan(256 * 1024);

      const response = await api()
        .post('/api/v1/notes')
        .set('Authorization', auth)
        .set('Content-Type', 'application/json')
        .send(escapedBody)
        .expect(201);

      expect(response.body.data.content).toBe('é'.repeat(50_000));
    });

    it('rejects a userId in the body (mass assignment)', async () => {
      const auth = await newUser();

      const response = await api()
        .post('/api/v1/notes')
        .set('Authorization', auth)
        .send({ title: 'Mine', userId: randomUUID() })
        .expect(400);

      expect(response.body.details).toEqual([
        { field: 'userId', message: 'property userId should not exist' },
      ]);
    });

    it('rejects invalid input', async () => {
      const auth = await newUser();

      const response = await api()
        .post('/api/v1/notes')
        .set('Authorization', auth)
        .send({ title: '   ', content: null, isPinned: 'yes' })
        .expect(400);

      expect(
        response.body.details.map((detail: { field: string }) => detail.field),
      ).toEqual(expect.arrayContaining(['title', 'content', 'isPinned']));
    });

    it('requires authentication', async () => {
      await api()
        .post('/api/v1/notes')
        .send({ title: 'Anonymous' })
        .expect(401);
    });
  });

  describe('read and update', () => {
    it('returns a single note', async () => {
      const auth = await newUser();
      const note = await createNote(auth, { title: 'Read me' });

      const response = await api()
        .get(`/api/v1/notes/${note.id}`)
        .set('Authorization', auth)
        .expect(200);

      expect(response.body.data).toEqual(note);
    });

    it('returns 400 for an ID that is not a UUID', async () => {
      const auth = await newUser();

      await api()
        .get('/api/v1/notes/not-a-uuid')
        .set('Authorization', auth)
        .expect(400);
    });

    it('returns 404 for an unknown note', async () => {
      const auth = await newUser();

      await api()
        .get(`/api/v1/notes/${randomUUID()}`)
        .set('Authorization', auth)
        .expect(404);
    });

    it('changes only the fields that were sent', async () => {
      const auth = await newUser();
      const note = await createNote(auth, {
        title: 'Keep me',
        content: 'Body',
      });

      const response = await api()
        .patch(`/api/v1/notes/${note.id}`)
        .set('Authorization', auth)
        .send({ isPinned: true })
        .expect(200);

      expect(response.body.data).toMatchObject({
        title: 'Keep me',
        content: 'Body',
        isPinned: true,
      });
      expect(Date.parse(response.body.data.updatedAt)).toBeGreaterThanOrEqual(
        Date.parse(note.updatedAt),
      );
    });

    it('rejects an empty update and null values', async () => {
      const auth = await newUser();
      const note = await createNote(auth);

      const empty = await api()
        .patch(`/api/v1/notes/${note.id}`)
        .set('Authorization', auth)
        .send({})
        .expect(400);
      expect(empty.body.message).toBe('Provide at least one field to update');

      await api()
        .patch(`/api/v1/notes/${note.id}`)
        .set('Authorization', auth)
        .send({ content: null })
        .expect(400);
    });
  });

  describe("another user's notes (BOLA protection)", () => {
    it('are invisible and untouchable, with 404 instead of 403', async () => {
      const owner = await newUser();
      const intruder = await newUser();
      const note = await createNote(owner, { title: 'Private diary' });

      await api()
        .get(`/api/v1/notes/${note.id}`)
        .set('Authorization', intruder)
        .expect(404);
      await api()
        .patch(`/api/v1/notes/${note.id}`)
        .set('Authorization', intruder)
        .send({ title: 'Hacked' })
        .expect(404);
      await api()
        .delete(`/api/v1/notes/${note.id}`)
        .set('Authorization', intruder)
        .expect(404);

      const intruderList = await listNotes(intruder);
      expect(intruderList.data).toEqual([]);

      // The owner's note is untouched
      const ownerView = await api()
        .get(`/api/v1/notes/${note.id}`)
        .set('Authorization', owner)
        .expect(200);
      expect(ownerView.body.data.title).toBe('Private diary');
    });
  });

  describe('delete', () => {
    it('soft-deletes: the note disappears everywhere but stays in the database', async () => {
      const auth = await newUser();
      const note = await createNote(auth, { title: 'Temporary' });

      await api()
        .delete(`/api/v1/notes/${note.id}`)
        .set('Authorization', auth)
        .expect(204);

      await api()
        .get(`/api/v1/notes/${note.id}`)
        .set('Authorization', auth)
        .expect(404);
      await api()
        .patch(`/api/v1/notes/${note.id}`)
        .set('Authorization', auth)
        .send({ title: 'Back?' })
        .expect(404);
      expect((await listNotes(auth)).data).toEqual([]);

      // Deleting again finds nothing to delete
      await api()
        .delete(`/api/v1/notes/${note.id}`)
        .set('Authorization', auth)
        .expect(404);

      const row = await prisma.note.findUniqueOrThrow({
        where: { id: note.id },
      });
      expect(row.deletedAt).not.toBeNull();
    });
  });

  describe('list', () => {
    it('paginates with correct meta, and a page past the end is empty', async () => {
      const auth = await newUser();
      for (let index = 1; index <= 5; index += 1) {
        await createNote(auth, { title: `Note ${index}` });
      }

      const firstPage = await listNotes(auth, { page: 1, limit: 2 });
      const pastTheEnd = await listNotes(auth, { page: 9, limit: 2 });

      expect(firstPage.data).toHaveLength(2);
      expect(firstPage.meta).toEqual({
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
      expect(pastTheEnd.data).toEqual([]);
      expect(pastTheEnd.meta.total).toBe(5);
    });

    it('keeps a stable order: every note appears on exactly one page', async () => {
      const auth = await newUser();
      const created = await Promise.all(
        [1, 2, 3, 4].map((index) =>
          createNote(auth, { title: `Same time ${index}` }),
        ),
      );

      const pages = await Promise.all(
        [1, 2, 3, 4].map((page) => listNotes(auth, { page, limit: 1 })),
      );
      const seenIds = pages.flatMap((result) =>
        result.data.map((note) => note.id),
      );

      expect(new Set(seenIds).size).toBe(4);
      expect([...seenIds].toSorted()).toEqual(
        created.map((note) => note.id).toSorted(),
      );
    });

    it('lists pinned notes first', async () => {
      const auth = await newUser();
      const pinned = await createNote(auth, {
        title: 'Pinned',
        isPinned: true,
      });
      await createNote(auth, { title: 'Newer but not pinned' });

      const { data } = await listNotes(auth);

      expect(data[0]?.id).toBe(pinned.id);
    });

    it('hides archived notes unless asked, and filters by pin state', async () => {
      const auth = await newUser();
      const archived = await createNote(auth, { title: 'Old stuff' });
      await api()
        .patch(`/api/v1/notes/${archived.id}`)
        .set('Authorization', auth)
        .send({ isArchived: true })
        .expect(200);
      const pinned = await createNote(auth, {
        title: 'Pinned',
        isPinned: true,
      });
      const plain = await createNote(auth, { title: 'Plain' });

      const active = await listNotes(auth);
      const archivedOnly = await listNotes(auth, { isArchived: true });
      const unpinnedOnly = await listNotes(auth, { isPinned: false });

      expect(active.data.map((note) => note.id).toSorted()).toEqual(
        [pinned.id, plain.id].toSorted(),
      );
      expect(archivedOnly.data.map((note) => note.id)).toEqual([archived.id]);
      expect(unpinnedOnly.data.map((note) => note.id)).toEqual([plain.id]);
    });

    it('sorts by a whitelisted field', async () => {
      const auth = await newUser();
      for (const title of ['banana', 'apple', 'cherry']) {
        await createNote(auth, { title });
      }

      const { data } = await listNotes(auth, {
        sortBy: 'title',
        sortOrder: 'asc',
      });

      expect(data.map((note) => note.title)).toEqual([
        'apple',
        'banana',
        'cherry',
      ]);
    });

    it('explains a repeated query parameter with a single clear message', async () => {
      const auth = await newUser();

      const response = await api()
        .get('/api/v1/notes?search=a&search=b')
        .set('Authorization', auth)
        .expect(400);

      expect(response.body.details).toEqual([
        { field: 'search', message: 'search must be a string' },
      ]);
    });

    it('rejects invalid query parameters', async () => {
      const auth = await newUser();

      for (const query of [
        { limit: 101 },
        { page: 0 },
        { isPinned: 'yes' },
        { sortBy: 'userId' },
      ]) {
        await api()
          .get('/api/v1/notes')
          .query(query)
          .set('Authorization', auth)
          .expect(400);
      }
    });

    describe('search', () => {
      let auth: string;

      beforeAll(async () => {
        auth = await newUser();
        await createNote(auth, { title: 'Budget 50% done' });
        await createNote(auth, { title: 'abc' });
        await createNote(auth, { title: 'my_notes' });
        await createNote(auth, {
          title: 'Recipes',
          content: 'Add MILK and eggs',
        });
      });

      const titlesFor = async (search: string): Promise<string[]> =>
        (await listNotes(auth, { search })).data
          .map((note) => note.title)
          .toSorted();

      it('matches title or content, case-insensitively', async () => {
        await expect(titlesFor('BUDGET')).resolves.toEqual(['Budget 50% done']);
        await expect(titlesFor('milk')).resolves.toEqual(['Recipes']);
      });

      it('treats % and _ literally, not as SQL wildcards', async () => {
        await expect(titlesFor('50%')).resolves.toEqual(['Budget 50% done']);
        await expect(titlesFor('5%')).resolves.toEqual([]);
        await expect(titlesFor('y_n')).resolves.toEqual(['my_notes']);
        await expect(titlesFor('a_c')).resolves.toEqual([]);
      });

      it('ignores a blank search', async () => {
        const { meta } = await listNotes(auth, { search: '   ' });

        expect(meta.total).toBe(4);
      });
    });
  });
});
