import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { overviewOf } from '../../../../test/adminFakes';
import { describeAdminChart, renderAdminWidget } from '../../../../test/adminWidgetHarness';
import AdmUsersRole, { ADM_USERS_ROLE_TITLE, admUsersRoleDefinition } from './admUsersRole';

const NBSP = ' ';

describeAdminChart({
  Widget: AdmUsersRole,
  definition: admUsersRoleDefinition,
  title: ADM_USERS_ROLE_TITLE,
  emptyCause: 'Sem dados no período',
  summary: 'Contas por papel, 42 no total: Pacientes 35; Profissionais de saúde 6; Administradores 1.',
  columns: ['Papel', 'Contas'],
  rows: [
    ['Pacientes', '35'],
    ['Profissionais de saúde', '6'],
    ['Administradores', '1'],
  ],
});

describe('adm-users-role figure (ADM-02)', () => {
  it('draws one slice per role and names each in pt-BR in the legend', async () => {
    const { container } = renderAdminWidget(<AdmUsersRole size="M" />);
    await screen.findByRole('img');

    expect(container.querySelectorAll('.recharts-pie-sector path')).toHaveLength(3);
    expect([...container.querySelectorAll('li')].map((item) => item.textContent)).toEqual(['Pacientes', 'Profissionais de saúde', 'Administradores']);
  });

  it('labels each slice with its share of the accounts', async () => {
    const { container } = renderAdminWidget(<AdmUsersRole size="M" />);
    await screen.findByRole('img');

    const shares = [...container.querySelectorAll('svg.recharts-surface text')].map((label) => label.textContent);
    expect(shares).toEqual([`83,3${NBSP}%`, `14,3${NBSP}%`, `2,4${NBSP}%`]);
  });

  it('keeps a role with no account in the summary, at zero', async () => {
    const accounts = { total: 4, byRole: [{ role: 'PATIENT' as const, count: 4 }, { role: 'HEALTH_PROFESSIONAL' as const, count: 0 }], byStatus: [] };
    renderAdminWidget(<AdmUsersRole size="M" />, { overview: overviewOf({ accounts }) });

    expect(await screen.findByRole('img', { name: 'Contas por papel, 4 no total: Pacientes 4; Profissionais de saúde 0.' })).toBeInTheDocument();
  });
});
