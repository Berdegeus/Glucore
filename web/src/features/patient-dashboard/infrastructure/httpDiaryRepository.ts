import * as z from 'zod';
import { createRepository, type HttpGateway, type RepositoryHttp } from '../../../shared/infrastructure/http/createRepository';
import type { CarbEntry, DiaryRepository, InsulinEntry, Reading } from '../domain/diary';
import { toCarbEntry, toInsulinEntry, toReading } from './diaryMappers';
import { CarbDtoSchema, InsulinDtoSchema, ReadingDtoSchema } from './diarySchemas';

/**
 * `/carbs` and `/insulin` answer the 100 most recent entries unless asked for
 * more; 500 is the most the API gives in one page, enough to cover the days
 * the readings (up to 5000, about 17 days) reach. That count holds because the
 * app uploads one reading per 5 minutes; at the sensor's own 1/min the same
 * 5000 rows would be 3.5 days. The summary cards do not read the readings at
 * all: they come from `/dashboard/summary`, which the glucose buckets feed.
 */
const PAGE = '?limit=500';

/**
 * The diary of the signed-in patient: `GET /readings`, `/carbs` and
 * `/insulin`, newest first (PAC-11). It has no method that writes, and the
 * client never sends anything else to these paths (PAC-18). An answer that
 * breaks the contract fails as `unknown`, naming the endpoint but never the
 * values, which are health data.
 */
export class HttpDiaryRepository implements DiaryRepository {
  private readonly api: RepositoryHttp;

  constructor(http: HttpGateway) {
    this.api = createRepository(http);
  }

  async listReadings(): Promise<Reading[]> {
    return (await this.api.fetchDto({ path: '/readings' }, z.array(ReadingDtoSchema))).map(toReading);
  }

  async listCarbs(): Promise<CarbEntry[]> {
    return (await this.api.fetchDto({ path: `/carbs${PAGE}` }, z.array(CarbDtoSchema))).map(toCarbEntry);
  }

  async listInsulin(): Promise<InsulinEntry[]> {
    return (await this.api.fetchDto({ path: `/insulin${PAGE}` }, z.array(InsulinDtoSchema))).map(toInsulinEntry);
  }
}
