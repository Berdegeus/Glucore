import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { createLoadDayDetail, type LoadDayDetail } from '../features/patient-dashboard/application/loadDayDetail';
import type { CarbEntry, InsulinEntry, Reading } from '../features/patient-dashboard/domain/diary';
import { DiaryServicesProvider } from '../features/patient-dashboard/presentation/diaryServices';
import { fakeDiary } from './diaryFakes';

export const TEST_ZONE = 'America/Sao_Paulo';

interface DiaryHarnessOptions {
  /** The diary the real use case reads, cut in `zone`. */
  diary?: { readings?: Reading[]; carbs?: CarbEntry[]; insulin?: InsulinEntry[] };
  zone?: string;
  /** Replaces the use case altogether, to fail it or hold it back. */
  load?: LoadDayDetail;
}

/** Mounts a widget that reads the diary: the real day detail use case over a fake repository, and a query client that does not retry. */
export function renderDiaryWidget(widget: ReactElement, { diary, zone = TEST_ZONE, load }: DiaryHarnessOptions = {}) {
  const { repository, calls } = fakeDiary(diary);
  const loadDayDetail = load ?? vi.fn(createLoadDayDetail({ diary: repository, timeZone: { timeZone: () => zone } }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <DiaryServicesProvider services={{ loadDayDetail }}>{widget}</DiaryServicesProvider>
    </QueryClientProvider>,
  );
  return { ...view, loadDayDetail, calls, client };
}
