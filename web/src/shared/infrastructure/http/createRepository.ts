import type { ZodType, output } from 'zod';
import type { FetchHttpClient, HttpRequest } from './fetchHttpClient';
import { parseDto } from './parseDto';

export type HttpGateway = Pick<FetchHttpClient, 'request'>;

export interface RepositoryHttp {
  /**
   * Sends the request and checks the answer against `schema` (ARQ-07). The
   * endpoint named in a contract error defaults to `METHOD path` without the
   * query string, which may name a patient; pass `endpoint` when the path
   * itself does (`/professional/patients/:id/summary`).
   */
  fetchDto<S extends ZodType>(request: HttpRequest, schema: S, endpoint?: string): Promise<output<S>>;
  /** For answers nobody reads (`DELETE`): any failure still throws the client's `AppError`. */
  send(request: HttpRequest): Promise<void>;
}

/** The request -> `parseDto` sequence every HTTP repository repeated, bound to one client. */
export function createRepository(http: HttpGateway): RepositoryHttp {
  return {
    async fetchDto(request, schema, endpoint) {
      const payload = await http.request(request);
      const label = endpoint ?? `${request.method ?? 'GET'} ${request.path.split('?')[0]}`;
      return parseDto(schema, payload, label);
    },
    async send(request) {
      await http.request(request);
    },
  };
}
