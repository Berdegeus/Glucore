/**
 * Base class for errors that already know their own HTTP answer.
 *
 * Services throw these instead of touching `res`, which is what lets a
 * `*.service.ts` stay free of express. The error handler turns them back into a
 * response.
 *
 * `code` is deliberately optional. The routes answer in two shapes today —
 * `{ error, code }` where a machine-readable code exists, and a bare
 * `{ error }` where it never did — and the characterization suite asserts both
 * with strict equality. Making `code` mandatory here would silently add a key
 * to a dozen responses. Standardizing on `{ error, code }` is a contract change
 * and belongs to the /api/v1 batch, not to a refactor.
 */
export abstract class AppError extends Error {
  abstract readonly status: number;

  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}
