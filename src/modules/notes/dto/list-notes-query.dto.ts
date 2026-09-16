import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  NOTE_SEARCH_MAX_LENGTH,
  NOTE_SORT_FIELDS,
  type NoteSortField,
  NOTES_PAGE_MAX,
  NOTES_PAGE_SIZE_DEFAULT,
  NOTES_PAGE_SIZE_MAX,
  SORT_ORDERS,
  type SortOrder,
} from './note-constraints.js';

/**
 * Query strings are always text. Boolean("false") is true, so only the exact strings
 * "true" and "false" are converted; anything else stays a string and fails @IsBoolean().
 */
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
};

/** An empty or whitespace-only search means "no search". */
const toSearchTerm = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ListNotesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NOTES_PAGE_MAX)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NOTES_PAGE_SIZE_MAX)
  limit: number = NOTES_PAGE_SIZE_DEFAULT;

  /** Matches title or content, case-insensitively */
  @IsOptional()
  @Transform(toSearchTerm)
  @IsString()
  @MaxLength(NOTE_SEARCH_MAX_LENGTH)
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isPinned?: boolean;

  /** Archived notes are hidden unless asked for */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isArchived: boolean = false;

  @IsOptional()
  @IsIn(NOTE_SORT_FIELDS)
  sortBy: NoteSortField = 'updatedAt';

  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder: SortOrder = 'desc';
}
