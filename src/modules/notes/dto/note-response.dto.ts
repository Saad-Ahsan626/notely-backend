import type { NoteModel } from '../../../generated/prisma/models.js';

/** The only note shape ever sent to clients (see docs/api-contract.md). */
export interface NoteResponse {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Internal fields (userId, deletedAt) are deliberately not exposed. */
export function toNoteResponse(note: NoteModel): NoteResponse {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    isPinned: note.isPinned,
    isArchived: note.isArchived,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}
