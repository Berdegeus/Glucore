import type { FetchHttpClient } from '../../../shared/infrastructure/http/fetchHttpClient';
import { parseDto } from '../../../shared/infrastructure/http/parseDto';
import type { DashboardLayout } from '../domain/layout';
import type { LayoutRepository } from '../domain/ports';
import { toLayout, toLayoutDto } from './mappers';
import { LoadedLayoutDtoSchema, SavedLayoutDtoSchema } from './schemas';

const PATH = '/preferences/dashboard';

/**
 * `GET`, `PUT` and `DELETE /preferences/dashboard` over HTTP (LAY-07 to LAY-09).
 * The user comes from the token alone; neither the path nor the body names one (LAY-12).
 * `400 INVALID_LAYOUT` surfaces as a `validation` error carrying that code (LAY-11).
 */
export class HttpLayoutRepository implements LayoutRepository {
  constructor(private readonly http: Pick<FetchHttpClient, 'request'>) {}

  async load(): Promise<DashboardLayout | null> {
    const payload = await this.http.request({ path: PATH });
    const dto = parseDto(LoadedLayoutDtoSchema, payload, `GET ${PATH}`);
    return dto.widgets === null ? null : toLayout({ widgets: dto.widgets });
  }

  async save(layout: DashboardLayout): Promise<DashboardLayout> {
    const payload = await this.http.request({ method: 'PUT', path: PATH, body: toLayoutDto(layout) });
    return toLayout(parseDto(SavedLayoutDtoSchema, payload, `PUT ${PATH}`));
  }

  async reset(): Promise<void> {
    await this.http.request({ method: 'DELETE', path: PATH });
  }
}
