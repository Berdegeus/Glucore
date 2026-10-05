import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { cohortSummaryOf } from '../../../../test/professionalFakes';
import { describeCohortChart, renderProfessionalWidget } from '../../../../test/professionalWidgetHarness';
import type { CohortPatient, CohortSummary } from '../../domain/cohort';
import ProRiskScatter, { PRO_RISK_SCATTER_TITLE, proRiskScatterDefinition } from './proRiskScatter';

const NBSP = ' ';
const BASE = `Dispersão do tempo no alvo (TIR) contra a variabilidade (CV) de`;
const LINES = `com linhas em TIR 70${NBSP}% e CV 36${NBSP}%.`;

describeCohortChart({
  Widget: ProRiskScatter,
  definition: proRiskScatterDefinition,
  title: PRO_RISK_SCATTER_TITLE,
  summary: `${BASE} 1 paciente, ${LINES} 1 paciente sem TIR ou CV no período não aparece.`,
  columns: ['Paciente', 'Tempo no alvo', 'CV'],
  rows: [['Ana Souza', `78,0${NBSP}%`, `31,5${NBSP}%`]],
});

const patient = (id: string, tir: number | null, cv: number | null): CohortPatient => ({
  ...cohortSummaryOf().perPatient[0]!,
  patientId: id,
  displayName: id,
  timeInRangePercent: tir,
  cvPercent: cv,
});

const cohortOf = (...patients: CohortPatient[]): CohortSummary => cohortSummaryOf({ patientCount: patients.length, perPatient: patients });

async function drawn(cohort: CohortSummary) {
  const { container } = renderProfessionalWidget(<ProRiskScatter size="M" />, { cohort });
  await screen.findByRole('button', { name: 'Ver como tabela' });
  const all = (selector: string) => [...container.querySelectorAll(selector)];
  return { all };
}

describe('pro-risk-scatter figure (PRO-10)', () => {
  it('draws a labelled point for each patient with a TIR and a CV, and none for the others', async () => {
    const { all } = await drawn(cohortOf(patient('Ana', 78, 31.5), patient('Bia', null, 20), patient('Caio', 55, null), patient('Davi', 40, 44)));

    expect(all('.recharts-scatter-symbol')).toHaveLength(2);
    expect(all('.recharts-label-list text').map((label) => label.textContent)).toEqual(['Ana', 'Davi']);
  });

  it('cuts the plot at TIR 70 and CV 36, the limits of the risk rule', async () => {
    const { all } = await drawn(cohortOf(patient('Ana', 78, 31.5)));

    const lines = all('.recharts-reference-line-line').map((line) => [line.getAttribute('x'), line.getAttribute('y')]);
    expect(lines).toEqual([
      ['70', null],
      [null, '36'],
    ]);
  });

  it.each([
    { patients: 1, omitted: 1, sentence: '1 paciente sem TIR ou CV no período não aparece.' },
    { patients: 0, omitted: 3, sentence: '3 pacientes sem TIR ou CV no período não aparecem.' },
  ])('says how many are left out: $sentence', async ({ patients, omitted, sentence }) => {
    const plotted = Array.from({ length: patients }, (_, index) => patient(`P${index}`, 60, 30));
    const left = Array.from({ length: omitted }, (_, index) => patient(`X${index}`, index === 0 ? null : 50, null));
    renderProfessionalWidget(<ProRiskScatter size="M" />, { cohort: cohortOf(...plotted, ...left) });

    expect(await screen.findByRole('img', { name: (name) => name.endsWith(sentence) })).toBeInTheDocument();
  });

  it('says nothing about omissions when every patient is plotted', async () => {
    renderProfessionalWidget(<ProRiskScatter size="M" />, { cohort: cohortOf(patient('Ana', 78, 31.5), patient('Bia', 50, 40)) });

    expect(await screen.findByRole('img', { name: `${BASE} 2 pacientes, ${LINES}` })).toBeInTheDocument();
  });

  it('lists the plotted patients, and only them, in the table', async () => {
    renderProfessionalWidget(<ProRiskScatter size="M" />, { cohort: cohortOf(patient('Ana', 78, 31.5), patient('Bia', null, 20)) });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Ver como tabela' }));

    expect(screen.getByRole('cell', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Bia' })).not.toBeInTheDocument();
  });
});
