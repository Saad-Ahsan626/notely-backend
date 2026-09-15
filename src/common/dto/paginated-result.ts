export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Returned by list endpoints. The response envelope sends it as `{ data, meta }`
 * instead of wrapping it again.
 */
export class PaginatedResult<T> {
  readonly meta: PaginationMeta;

  constructor(
    readonly data: T[],
    { page, limit, total }: Omit<PaginationMeta, 'totalPages'>,
  ) {
    this.meta = { page, limit, total, totalPages: Math.ceil(total / limit) };
  }
}
