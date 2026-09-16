import { Injectable } from '@nestjs/common';
import { escapeLikePattern } from '../../database/escape-like.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  NoteModel,
  NoteWhereInput,
} from '../../generated/prisma/models.js';
import type { NoteSortField, SortOrder } from './dto/note-constraints.js';

export interface CreateNoteData {
  title: string;
  content: string;
  isPinned: boolean;
}

export interface NoteChanges {
  title?: string;
  content?: string;
  isPinned?: boolean;
  isArchived?: boolean;
}

export interface NoteListOptions {
  search?: string;
  isPinned?: boolean;
  isArchived: boolean;
  sortBy: NoteSortField;
  sortOrder: SortOrder;
  skip: number;
  take: number;
}

/**
 * All note database access. Every method requires the owner's ID and ignores soft-deleted
 * notes, so no query can read or change another user's data (OWASP API1: BOLA).
 */
@Injectable()
export class NotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, data: CreateNoteData): Promise<NoteModel> {
    return this.prisma.note.create({ data: { ...data, userId } });
  }

  findOwned(userId: string, id: string): Promise<NoteModel | null> {
    return this.prisma.note.findFirst({ where: ownedActive(userId, id) });
  }

  /**
   * One page plus the total count. Both queries run in one transaction so `total`
   * describes the same snapshot as the returned rows.
   */
  async list(
    userId: string,
    options: NoteListOptions,
  ): Promise<{ items: NoteModel[]; total: number }> {
    const search = options.search && escapeLikePattern(options.search);
    const where: NoteWhereInput = {
      ...ownedActive(userId),
      isArchived: options.isArchived,
      ...(options.isPinned !== undefined && { isPinned: options.isPinned }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { content: { contains: search } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.note.findMany({
        where,
        orderBy: [
          // Pinned notes first, like most note apps
          { isPinned: 'desc' },
          { [options.sortBy]: options.sortOrder },
          // Unique tie-breaker: without it, notes with equal sort values can repeat or
          // vanish between pages
          { id: options.sortOrder },
        ],
        skip: options.skip,
        take: options.take,
      }),
      this.prisma.note.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Check and change in one statement (no read-then-write race). Returns null when the note
   * does not exist, belongs to someone else, or is deleted.
   */
  updateOwned(
    userId: string,
    id: string,
    changes: NoteChanges,
  ): Promise<NoteModel | null> {
    // One transaction: the updated row stays locked until it has been read back, so a
    // concurrent delete cannot turn a successful update into a 404
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.note.updateMany({
        where: ownedActive(userId, id),
        data: changes,
      });

      return count === 0
        ? null
        : tx.note.findFirst({ where: ownedActive(userId, id) });
    });
  }

  /** Soft delete. Returns false when there was no matching active note. */
  async softDeleteOwned(userId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.note.updateMany({
      where: ownedActive(userId, id),
      data: { deletedAt: new Date() },
    });

    return count === 1;
  }
}

/** The filter every note query starts from. */
function ownedActive(userId: string, id?: string): NoteWhereInput {
  return { userId, deletedAt: null, ...(id !== undefined && { id }) };
}
