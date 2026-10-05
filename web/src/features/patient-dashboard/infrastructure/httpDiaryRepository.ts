import * as z from 'zod';
import type { FetchHttpClient } from '../../../shared/infrastructure/http/fetchHttpClient';
import { parseDto } from '../../../shared/infrastructure/http/parseDto';
import type { CarbEntry, DiaryRepository, InsulinEntry, Reading } from '../domain/diary';
import { toCarbEntry, toInsulinEntry, toReading } from './diaryMappers';
import { CarbDtoSchema, InsulinDtoSchema, ReadingDtoSchema } from './diarySchemas';

/**
 * `/carbs` and `/insulin` answer the 100 most recent entries unless asked for
 * more; 500 is the most the API gives in one page, enough to cover the days
 * the readings (up to 5000, about 17 days) reach.
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
  constructor(private readonly http: Pick<FetchHttpClient, 'request'>) {}

  async listReadings(): Promise<Reading[]> {
    const payload = await this.http.request({ path: '/readings' });
    return parseDto(z.array(ReadingDtoSchema), payload, 'GET /readings').map(toReading);
  }

  async listCarbs(): Promise<CarbEntry[]> {
    const payload = await this.http.request({ path: `/carbs${PAGE}` });
    return parseDto(z.array(CarbDtoSchema), payload, 'GET /carbs').map(toCarbEntry);
  }

  async listInsulin(): Promise<InsulinEntry[]> {
    const payload = await this.http.request({ path: `/insulin${PAGE}` });
    return parseDto(z.array(InsulinDtoSchema), payload, 'GET /insulin').map(toInsulinEntry);
  }
}
