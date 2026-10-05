import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { overviewOf } from '../../../../test/adminFakes';
import { describeAdminChart, renderDrawnChart } from '../../../../test/adminWidgetHarness';
import AdmReadingsVolume, { ADM_READINGS_VOLUME_TITLE, admReadingsVolumeDefinition } from './admReadingsVolume';

describeAdminChart({
  Widget: AdmReadingsVolume,
  definition: admReadingsVolumeDefinition,
  title: ADM_READINGS_VOLUME_TITLE,
  emptyCause: 'Sem dados no período',
  summary: 'Leituras ingeridas por dia, 10100 no total, de 05/08 a 06/08.',
  columns: ['Dia', 'Leituras'],
  rows: [
    ['05/08/2026', '5120'],
    ['06/08/2026', '4980'],
  ],
});

describe('adm-readings-volume figure (ADM-02)', () => {
  it('draws the readings of each day as a filled area under the line', async () => {
    const { all, axisLabels } = await renderDrawnChart(<AdmReadingsVolume size="M" />);

    expect(all('.recharts-area-area')).toHaveLength(1);
    expect(all('.recharts-area-curve')).toHaveLength(1);
    expect(axisLabels()).toEqual(['05/08', '06/08']);
  });

  it('adds up the days of a longer period in the summary', async () => {
    const readingsByDay = [
      { day: '2026-08-04', count: 100 },
      { day: '2026-08-05', count: 250 },
      { day: '2026-08-06', count: 0 },
    ];
    const { axisLabels } = await renderDrawnChart(<AdmReadingsVolume size="M" />, { overview: overviewOf({ readingsByDay }) });

    expect(axisLabels()).toEqual(['04/08', '05/08', '06/08']);
    expect(screen.getByRole('img', { name: 'Leituras ingeridas por dia, 350 no total, de 04/08 a 06/08.' })).toBeInTheDocument();
  });
});
