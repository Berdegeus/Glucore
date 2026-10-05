import type { ZodType, output } from 'zod';
import { AppError } from '../../domain/appError';

/**
 * Checks an API payload against its schema at the infrastructure edge
 * (ARQ-07), so a broken contract fails here and not inside a component.
 * The error names the endpoint and the offending paths, never the values:
 * the body may hold health data.
 */
export function parseDto<S extends ZodType>(schema: S, data: unknown, endpoint: string): output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const paths = result.error.issues.map((issue) => issue.path.join('.') || '(root)');
  const error = new AppError('unknown');
  error.message = `Unexpected response from ${endpoint} at ${paths.join(', ')}`;
  throw error;
}
