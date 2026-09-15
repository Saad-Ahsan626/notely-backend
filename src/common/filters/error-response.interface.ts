import type { ValidationErrorDetail } from '../validation/validation.exception.js';

/** The single error shape returned by every endpoint (see docs/api-contract.md). */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: ValidationErrorDetail[];
  path: string;
  timestamp: string;
  requestId: string;
}
