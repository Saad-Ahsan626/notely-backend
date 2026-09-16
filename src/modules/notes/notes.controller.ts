import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { PaginatedResult } from '../../common/dto/paginated-result.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { CreateNoteDto } from './dto/create-note.dto.js';
import { ListNotesQueryDto } from './dto/list-notes-query.dto.js';
import type { NoteResponse } from './dto/note-response.dto.js';
import { UpdateNoteDto } from './dto/update-note.dto.js';
import { NotesService } from './notes.service.js';

/** All routes require authentication and only ever act on the caller's own notes. */
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  async create(
    @CurrentUser() { userId }: AuthenticatedUser,
    @Body() dto: CreateNoteDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<NoteResponse> {
    const note = await this.notesService.create(userId, dto);

    // REST convention: 201 Created points to the new resource
    // Strip the query string and any trailing slash, so POST /notes/ gives /notes/{id}
    const collectionPath = (request.originalUrl.split('?')[0] ?? '').replace(
      /\/+$/,
      '',
    );
    response.location(`${collectionPath}/${note.id}`);

    return note;
  }

  @Get()
  list(
    @CurrentUser() { userId }: AuthenticatedUser,
    @Query() query: ListNotesQueryDto,
  ): Promise<PaginatedResult<NoteResponse>> {
    return this.notesService.list(userId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() { userId }: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NoteResponse> {
    return this.notesService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() { userId }: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<NoteResponse> {
    return this.notesService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() { userId }: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notesService.remove(userId, id);
  }
}
