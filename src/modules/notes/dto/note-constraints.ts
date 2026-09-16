/** Shared limits, so create, update and docs can never disagree. */
export const NOTE_TITLE_MAX_LENGTH = 255;
export const NOTE_CONTENT_MAX_LENGTH = 50_000;

export const NOTE_SORT_FIELDS = ['createdAt', 'updatedAt', 'title'] as const;
export type NoteSortField = (typeof NOTE_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const NOTES_PAGE_SIZE_DEFAULT = 20;
export const NOTES_PAGE_SIZE_MAX = 100;
/** Guards against absurd offsets such as ?page=999999999 */
export const NOTES_PAGE_MAX = 10_000;

export const NOTE_SEARCH_MAX_LENGTH = 100;
