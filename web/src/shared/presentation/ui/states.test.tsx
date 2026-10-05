import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { EmptyState, ErrorState, Forbidden, Skeleton } from './states';

describe('shared UI states', () => {
  it('has no axe violations in any state (RSP-06)', async () => {
    const { container } = render(
      <main>
        <Skeleton height={120} />
        <EmptyState cause="Não há leituras neste período" />
        <ErrorState onRetry={() => undefined} />
        <Forbidden />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('announces loading and gives the skeleton the requested height (LAY-16)', () => {
    render(<Skeleton height={120} />);
    expect(screen.getByRole('status', { name: 'Carregando' })).toHaveStyle({ height: '120px' });
  });

  it('shows the cause of an empty state (LAY-16)', () => {
    render(<EmptyState cause="Não há leituras neste período" />);
    expect(screen.getByRole('status')).toHaveTextContent('Sem dados');
    expect(screen.getByText('Não há leituras neste período')).toBeInTheDocument();
  });

  it('retries with the mouse and with Enter and Space (RSP-06)', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState onRetry={onRetry} message="Serviço indisponível." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Serviço indisponível.');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(3);
  });

  it('says the person has no access and offers no retry (ACC-05)', () => {
    render(<Forbidden />);
    expect(screen.getByRole('alert')).toHaveTextContent('Você não tem acesso a este conteúdo');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
