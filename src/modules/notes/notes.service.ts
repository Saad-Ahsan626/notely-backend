import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResult } from '../../common/dto/paginated-result.js';
import type { CreateNoteDto } from './dto/create-note.dto.js';
import type { ListNotesQueryDto } from './dto/list-notes-query.dto.js';
import { type NoteResponse, toNoteResponse } from './dto/note-response.dto.js';
import type { UpdateNoteDto } from './dto/update-note.dto.js';
import { type NoteChanges, NotesRepository } from './notes.repository.js';

@Injectable()
export class NotesService {
  constructor(private readonly notesRepository: NotesRepository) {}

  async create(userId: string, dto: CreateNoteDto): Promise<NoteResponse> {
    const note = await this.notesRepository.create(userId, {
      title: dto.title,
      // MySQL cannot default a MEDIUMTEXT column, so the API supplies the default
      content: dto.content ?? '',
      isPinned: dto.isPinned ?? false,
    });

    return toNoteResponse(note);
  }

  async list(
    userId: string,
    query: ListNotesQueryDto,
  ): Promise<PaginatedResult<NoteResponse>> {
    const { items, total } = await this.notesRepository.list(userId, {
      search: query.search,
      isPinned: query.isPinned,
      isArchived: query.isArchived,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    // A page past the end is not an error: it is simply empty
    return new PaginatedResult(items.map(toNoteResponse), {
      page: query.page,
      limit: query.limit,
      total,
    });
  }

  async findOne(userId: string, id: string): Promise<NoteResponse> {
    const note = await this.notesRepository.findOwned(userId, id);

    if (!note) {
      throw noteNotFound();
    }

    return toNoteResponse(note);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateNoteDto,
  ): Promise<NoteResponse> {
    const changes = definedFields(dto);

    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const note = await this.notesRepository.updateOwned(userId, id, changes);

    if (!note) {
      throw noteNotFound();
    }

    return toNoteResponse(note);
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.notesRepository.softDeleteOwned(userId, id);

    if (!deleted) {
      throw noteNotFound();
    }
  }
}

/**
 * Also used when the note belongs to another user: a 403 would confirm the note exists.
 */
function noteNotFound(): NotFoundException {
  return new NotFoundException('Note not found');
}

/** Keeps only the fields the client actually sent. */
function definedFields(dto: UpdateNoteDto): NoteChanges {
  const changes: NoteChanges = {};

  if (dto.title !== undefined) {
    changes.title = dto.title;
  }
  if (dto.content !== undefined) {
    changes.content = dto.content;
  }
  if (dto.isPinned !== undefined) {
    changes.isPinned = dto.isPinned;
  }
  if (dto.isArchived !== undefined) {
    changes.isArchived = dto.isArchived;
  }

  return changes;
}
