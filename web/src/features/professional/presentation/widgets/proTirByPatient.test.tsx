import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ZONE_COLORS } from '../../../../shared/presentation/charts/palette';
import { cohortSummaryOf } from '../../../../test/professionalFakes';
import { describeCohortChart, renderProfessionalWidget } from '../../../../test/professionalWidgetHarness';
import ProTirByPatient, { PRO_TIR_BY_PATIENT_TITLE, proTirByPatientDefinition } from './proTirByPatient';

const NBSP = ' ';
const pct = (value: number) => `${value.toFixed(1).replace('.', ',')}${NBSP}%`;
const ZONE_NAMES = ['Muito baixa', 'Baixa', 'No alvo', 'Alta', 'Muito alta'];
const ZONES_OF_FIXTURE = [pct(0), pct(2), pct(78), pct(18), pct(2)];

describeCohortChart({
  Widget: ProTirByPatient,
  definition: proTirByPatientDefinition,
  title: PRO_TIR_BY_PATIENT_TITLE,
  summary: 'Distribuição do tempo nas cinco zonas de glicose de cada um dos 2 pacientes.',
  columns: ['Paciente', 'Muito baixa', 'Baixa', 'No alvo', 'Alta', 'Muito alta'],
  rows: [
    ['Ana Souza', ...ZONES_OF_FIXTURE],
    ['PB2', ...ZONES_OF_FIXTURE],
  ],
});

describe('pro-tir-by-patient figure (PRO-10)', () => {
  it('names the five zones in the legend, from very low to very high', async () => {
    renderProfessionalWidget(<ProTirByPatient size="M" />);

    const legend = await within(await screen.findByRole('region', { name: PRO_TIR_BY_PATIENT_TITLE })).findAllByRole('listitem');

    expect(legend.map((item) => item.textContent)).toEqual(ZONE_NAMES);
  });

  it('draws the segments of each patient in the hues of their zones', async () => {
    const { container } = renderProfessionalWidget(<ProTirByPatient size="M" />);
    await screen.findByRole('button', { name: 'Ver como tabela' });

    const fills = [...container.querySelectorAll('.recharts-bar-rectangle path')].map((bar) => bar.getAttribute('fill'));

    // The fixture has no very low share, so each of the two patients has the four segments above it; Recharts lists them zone by zone.
    expect(fills).toEqual(ZONE_COLORS.slice(1).flatMap((color) => [color, color]));
  });

  it('labels each bar with the name of its patient, or the initials when there is no name', async () => {
    const { container } = renderProfessionalWidget(<ProTirByPatient size="M" />);
    await screen.findByRole('button', { name: 'Ver como tabela' });

    const labels = [...container.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')].map((tick) => tick.textContent);
    expect(labels).toEqual(['Ana Souza', 'PB2']);
  });

  it('reads "paciente" in the singular for one patient', async () => {
    const [first] = cohortSummaryOf().perPatient;
    renderProfessionalWidget(<ProTirByPatient size="M" />, { cohort: cohortSummaryOf({ patientCount: 1, perPatient: first ? [first] : [] }) });

    expect(await screen.findByRole('img', { name: 'Distribuição do tempo nas cinco zonas de glicose de cada um dos 1 paciente.' })).toBeInTheDocument();
  });
});
