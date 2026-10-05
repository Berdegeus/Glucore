import type { AppError } from '../../../shared/domain/appError';

export interface Entity {
  id: string;
  error?: AppError;
}
