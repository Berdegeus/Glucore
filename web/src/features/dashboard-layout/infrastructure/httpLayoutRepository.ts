import { createRepository, type HttpGateway, type RepositoryHttp } from '../../../shared/infrastructure/http/createRepository';
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
  private readonly api: RepositoryHttp;

  constructor(http: HttpGateway) {
    this.api = createRepository(http);
  }

  async load(): Promise<DashboardLayout | null> {
    const dto = await this.api.fetchDto({ path: PATH }, LoadedLayoutDtoSchema);
    return dto.widgets === null ? null : toLayout({ widgets: dto.widgets });
  }

  async save(layout: DashboardLayout): Promise<DashboardLayout> {
    return toLayout(await this.api.fetchDto({ method: 'PUT', path: PATH, body: toLayoutDto(layout) }, SavedLayoutDtoSchema));
  }

  async reset(): Promise<void> {
    await this.api.send({ method: 'DELETE', path: PATH });
  }
}
