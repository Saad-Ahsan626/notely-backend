import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Length, MaxLength } from 'class-validator';
import { IsOptionalNotNull } from '../../../common/validation/is-optional-not-null.decorator.js';
import {
  NOTE_CONTENT_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
} from './note-constraints.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateNoteDto {
  // Trimmed first, so a whitespace-only title fails the length rule
  @IsString()
  @Transform(trim)
  @Length(1, NOTE_TITLE_MAX_LENGTH)
  title: string;

  // Not trimmed: the user's formatting is part of the note
  @IsOptionalNotNull()
  @IsString()
  @MaxLength(NOTE_CONTENT_MAX_LENGTH)
  content?: string;

  @IsOptionalNotNull()
  @IsBoolean()
  isPinned?: boolean;
}
