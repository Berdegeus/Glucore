import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ERROR_MESSAGE, RETRY_LABEL } from '../../../shared/presentation/ui/states';
import { WIDGET_SIZES } from '../domain/layout';
import { DashboardGrid, GridItem } from './dashboardGrid';
import { SKELETON_HEIGHT, WidgetShell, type WidgetState } from './widgetShell';

const CONTENT = 'gráfico pronto';

function renderShell(state: WidgetState, size?: Parameters<typeof WidgetShell>[0]['size']) {
  return render(
    <WidgetShell title="Tempo no alvo" state={state} size={size}>
      <p>{CONTENT}</p>
    </WidgetShell>,
  );
}

describe('WidgetShell states (LAY-15, LAY-16)', () => {
  it('names the card by its title', () => {
    renderShell({ kind: 'ready' });

    expect(screen.getByRole('region', { name: 'Tempo no alvo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tempo no alvo' })).toBeInTheDocument();
  });

  it('shows the widget when ready', () => {
    renderShell({ kind: 'ready' });

    expect(screen.getByText(CONTENT)).toBeInTheDocument();
  });

  it.each(WIDGET_SIZES)('shows a skeleton the height of a %s widget while loading, and not the widget', (size) => {
    renderShell({ kind: 'loading' }, size);

    expect(screen.getByRole('status', { name: 'Carregando' })).toHaveStyle({ height: SKELETON_HEIGHT[size] });
    expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
  });

  it('sizes the skeleton as a medium widget by default, taller for L than for S', () => {
    renderShell({ kind: 'loading' });

    expect(screen.getByRole('status', { name: 'Carregando' })).toHaveStyle({ height: SKELETON_HEIGHT.M });
    expect(parseFloat(SKELETON_HEIGHT.S)).toBeLessThan(parseFloat(SKELETON_HEIGHT.M));
    expect(parseFloat(SKELETON_HEIGHT.M)).toBeLessThan(parseFloat(SKELETON_HEIGHT.L));
  });

  it('shows the cause when there is no data, and not the widget', () => {
    renderShell({ kind: 'empty', cause: 'Não há leituras neste período' });

    expect(screen.getByText('Não há leituras neste período')).toBeInTheDocument();
    expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
  });

  it('shows the error with "Tentar novamente", which calls onRetry', async () => {
    const onRetry = vi.fn();
    renderShell({ kind: 'error', onRetry });

    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGE);
    expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: RETRY_LABEL }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the message the widget gives for its own failure', () => {
    renderShell({ kind: 'error', onRetry: () => undefined, message: 'Falha ao carregar o resumo' });

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar o resumo');
  });

  it('has no axe violations in any state', async () => {
    const states: WidgetState[] = [
      { kind: 'loading' },
      { kind: 'ready' },
      { kind: 'empty', cause: 'Sem leituras' },
      { kind: 'error', onRetry: () => undefined },
    ];
    const { container } = render(
      <main>
        {states.map((state) => (
          <WidgetShell key={state.kind} title={`Widget ${state.kind}`} state={state}>
            <p>conteúdo</p>
          </WidgetShell>
        ))}
      </main>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('WidgetShell error boundary (LAY-15)', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    // React reports a caught render error on the console; the test expects it.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => consoleError.mockRestore());

  function Bomb({ shouldThrow }: { shouldThrow: () => boolean }) {
    if (shouldThrow()) throw new Error('boom');
    return <p>recuperado</p>;
  }

  function renderDashboard(shouldThrow: () => boolean) {
    return render(
      <DashboardGrid>
        <GridItem size="M">
          <WidgetShell title="Quebrado" state={{ kind: 'ready' }}>
            <Bomb shouldThrow={shouldThrow} />
          </WidgetShell>
        </GridItem>
        <GridItem size="M">
          <WidgetShell title="Vizinho" state={{ kind: 'ready' }}>
            <p>vizinho intacto</p>
          </WidgetShell>
        </GridItem>
      </DashboardGrid>,
    );
  }

  it('shows the error only in the widget that throws and keeps the neighbor rendering', () => {
    renderDashboard(() => true);

    const broken = screen.getByRole('region', { name: 'Quebrado' });
    expect(within(broken).getByRole('alert')).toHaveTextContent(ERROR_MESSAGE);
    expect(within(broken).getByRole('button', { name: RETRY_LABEL })).toBeInTheDocument();
    const neighbor = screen.getByRole('region', { name: 'Vizinho' });
    expect(within(neighbor).getByText('vizinho intacto')).toBeInTheDocument();
    expect(within(neighbor).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the title of the broken widget on screen', () => {
    renderDashboard(() => true);

    expect(screen.getByRole('heading', { name: 'Quebrado' })).toBeInTheDocument();
  });

  it('renders the widget again on "Tentar novamente" once it stops throwing', async () => {
    let broken = true;
    renderDashboard(() => broken);

    broken = false;
    await userEvent.click(screen.getByRole('button', { name: RETRY_LABEL }));

    expect(screen.getByText('recuperado')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error again when the retry throws again', async () => {
    renderDashboard(() => true);

    await userEvent.click(screen.getByRole('button', { name: RETRY_LABEL }));

    expect(within(screen.getByRole('region', { name: 'Quebrado' })).getByRole('alert')).toBeInTheDocument();
  });
});
