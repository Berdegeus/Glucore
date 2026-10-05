import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { mockApi } from '../test/apiMocks';
import { renderApp } from '../test/appHarness';
import { stubChartContainer } from '../test/chartContainer';
import { LOADING_LABEL } from '../shared/presentation/ui/states';

stubChartContainer();
// Loading all 16 widgets and running axe over them can pass the default 5 s on a busy machine.
vi.setConfig({ testTimeout: 60_000 });
const SLOW = { timeout: 15_000 };

/** The page is drawn once every widget has left its loading skeleton. */
async function patientPageLoaded(view: ReturnType<typeof renderApp>) {
  await screen.findByRole('heading', { level: 1, name: 'Meu painel' }, SLOW);
  await waitFor(() => expect(screen.queryAllByRole('status', { name: LOADING_LABEL })).toHaveLength(0), SLOW);
  return view.container;
}

const nameOf = (element: Element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '';

describe('accessibility of the pages (RSP-06, RSP-11)', () => {
  it('has no axe violations on the login page', async () => {
    mockApi({ role: null });
    const { container } = renderApp('/login');
    await screen.findByLabelText('E-mail');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations on the patient dashboard with its 16 widgets drawn from data', async () => {
    mockApi();
    const container = await patientPageLoaded(renderApp('/paciente', { token: 'token-1' }));
    // Each widget names itself with one h2; the table of episodes also scrolls in a region of its own.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(16);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reaches the period filter, "Atualizar" and "Sair" with Tab alone', async () => {
    mockApi({ layout: [{ id: 'kpi-tir', size: 'S' }] });
    await patientPageLoaded(renderApp('/paciente', { token: 'token-1' }));
    const user = userEvent.setup();

    const reached: string[] = [];
    for (let stop = 0; stop < 40 && !['Sair', 'Atualizar'].every((name) => reached.includes(name)); stop += 1) {
      await user.tab();
      reached.push(nameOf(document.activeElement ?? document.body));
    }

    expect(reached).toEqual(expect.arrayContaining(['Sair', '14 dias', 'Atualizar']));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Atualizar' }));
  });
});
