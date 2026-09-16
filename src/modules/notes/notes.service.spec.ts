import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { NoteModel } from '../../generated/prisma/models.js';
import type { ListNotesQueryDto } from './dto/list-notes-query.dto.js';
import type { NotesRepository } from './notes.repository.js';
import { NotesService } from './notes.service.js';

const NOW = new Date('2026-09-16T10:00:00.000Z');

function buildNote(overrides: Partial<NoteModel> = {}): NoteModel {
  return {
    id: 'note-1',
    userId: 'user-1',
    title: 'Groceries',
    content: 'Milk',
    isPinned: false,
    isArchived: false,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildQuery(
  overrides: Partial<ListNotesQueryDto> = {},
): ListNotesQueryDto {
  return {
    page: 1,
    limit: 20,
    isArchived: false,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    ...overrides,
  };
}

describe('NotesService', () => {
  const repository = {
    create: vi.fn<NotesRepository['create']>(),
    list: vi.fn<NotesRepository['list']>(),
    findOwned: vi.fn<NotesRepository['findOwned']>(),
    updateOwned: vi.fn<NotesRepository['updateOwned']>(),
    softDeleteOwned: vi.fn<NotesRepository['softDeleteOwned']>(),
  };
  const service = new NotesService(repository as unknown as NotesRepository);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('defaults content to an empty string and isPinned to false', async () => {
      repository.create.mockResolvedValue(buildNote({ content: '' }));

      await service.create('user-1', { title: 'Groceries' });

      expect(repository.create).toHaveBeenCalledWith('user-1', {
        title: 'Groceries',
        content: '',
        isPinned: false,
      });
    });

    it('returns the public shape without internal fields', async () => {
      repository.create.mockResolvedValue(buildNote());

      const note = await service.create('user-1', { title: 'Groceries' });

      expect(note).not.toHaveProperty('userId');
      expect(note).not.toHaveProperty('deletedAt');
      expect(note.createdAt).toBe('2026-09-16T10:00:00.000Z');
    });
  });

  describe('list', () => {
    it('translates page and limit into skip and take', async () => {
      repository.list.mockResolvedValue({ items: [], total: 0 });

      await service.list('user-1', buildQuery({ page: 3, limit: 10 }));

      expect(repository.list).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('passes filters and sorting through', async () => {
      repository.list.mockResolvedValue({ items: [], total: 0 });

      await service.list(
        'user-1',
        buildQuery({
          search: 'milk',
          isPinned: true,
          isArchived: true,
          sortBy: 'title',
          sortOrder: 'asc',
        }),
      );

      expect(repository.list).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          search: 'milk',
          isPinned: true,
          isArchived: true,
          sortBy: 'title',
          sortOrder: 'asc',
        }),
      );
    });

    it('returns data with pagination meta', async () => {
      repository.list.mockResolvedValue({
        items: [buildNote(), buildNote({ id: 'note-2' })],
        total: 45,
      });

      const result = await service.list(
        'user-1',
        buildQuery({ page: 2, limit: 20 }),
      );

      expect(result.data.map((note) => note.id)).toEqual(['note-1', 'note-2']);
      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
    });
  });

  describe('findOne', () => {
    it('returns the owned note', async () => {
      repository.findOwned.mockResolvedValue(buildNote());

      await expect(service.findOne('user-1', 'note-1')).resolves.toMatchObject({
        id: 'note-1',
      });
      expect(repository.findOwned).toHaveBeenCalledWith('user-1', 'note-1');
    });

    it('throws 404 for missing, deleted or foreign notes', async () => {
      repository.findOwned.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'note-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('sends only the fields that were provided', async () => {
      repository.updateOwned.mockResolvedValue(buildNote({ isPinned: true }));

      await service.update('user-1', 'note-1', { isPinned: true });

      expect(repository.updateOwned).toHaveBeenCalledWith('user-1', 'note-1', {
        isPinned: true,
      });
    });

    it('allows clearing the content with an empty string', async () => {
      repository.updateOwned.mockResolvedValue(buildNote({ content: '' }));

      await service.update('user-1', 'note-1', { content: '' });

      expect(repository.updateOwned).toHaveBeenCalledWith('user-1', 'note-1', {
        content: '',
      });
    });

    it('rejects an update with no fields', async () => {
      await expect(
        service.update('user-1', 'note-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.updateOwned).not.toHaveBeenCalled();
    });

    it('throws 404 when no owned, active note matched', async () => {
      repository.updateOwned.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'note-1', { title: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes the owned note', async () => {
      repository.softDeleteOwned.mockResolvedValue(true);

      await service.remove('user-1', 'note-1');

      expect(repository.softDeleteOwned).toHaveBeenCalledWith(
        'user-1',
        'note-1',
      );
    });

    it('throws 404 when nothing was deleted', async () => {
      repository.softDeleteOwned.mockResolvedValue(false);

      await expect(service.remove('user-1', 'note-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
