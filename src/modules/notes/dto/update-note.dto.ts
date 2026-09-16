import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Length, MaxLength } from 'class-validator';
import { IsOptionalNotNull } from '../../../common/validation/is-optional-not-null.decorator.js';
import {
  NOTE_CONTENT_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
} from './note-constraints.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Partial update: a missing field means "leave unchanged", while `null` is rejected.
 * Written by hand instead of PartialType(CreateNoteDto), because PartialType applies
 * @IsOptional(), which lets `null` through to a NOT NULL column.
 */
export class UpdateNoteDto {
  @IsOptionalNotNull()
  @IsString()
  @Transform(trim)
  @Length(1, NOTE_TITLE_MAX_LENGTH)
  title?: string;

  @IsOptionalNotNull()
  @IsString()
  @MaxLength(NOTE_CONTENT_MAX_LENGTH)
  content?: string;

  @IsOptionalNotNull()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  isArchived?: boolean;
}
