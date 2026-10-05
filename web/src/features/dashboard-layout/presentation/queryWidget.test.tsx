import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import { ERROR_MESSAGE, RETRY_LABEL } from '../../../shared/presentation/ui/states';
import { QueryWidget } from './queryWidget';

const CAUSE = 'Nada por aqui';

function Probe({ load, empty = false }: { load: () => Promise<number>; empty?: boolean }) {
  const query = useQuery<number, AppError>({ queryKey: ['probe'], queryFn: load });
  return (
    <QueryWidget query={query} title="Sonda" size="S" isEmpty={() => empty} emptyCause={CAUSE}>
      {(value) => <p>valor {value}</p>}
    </QueryWidget>
  );
}

function mount(load: () => Promise<number>, empty?: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Probe load={load} empty={empty} />
    </QueryClientProvider>,
  );
}

describe('QueryWidget (LAY-15, LAY-16)', () => {
  it('shows the skeleton while the query has no data', () => {
    mount(() => new Promise(() => undefined));

    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
  });

  it('draws the figure once the data is there', async () => {
    mount(() => Promise.resolve(7));

    expect(await screen.findByText('valor 7')).toBeInTheDocument();
  });

  it('says the cause instead of the figure when the data is empty', async () => {
    mount(() => Promise.resolve(0), true);

    expect(await screen.findByText(CAUSE)).toBeInTheDocument();
    expect(screen.queryByText('valor 0')).not.toBeInTheDocument();
  });

  it('shows the figure of a value of zero, which is data and not emptiness', async () => {
    mount(() => Promise.resolve(0));

    expect(await screen.findByText('valor 0')).toBeInTheDocument();
  });

  it('shows an isolated error with retry that asks the query again', async () => {
    const load = vi.fn().mockRejectedValueOnce(new AppError('unavailable')).mockResolvedValue(3);
    mount(load);

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_MESSAGE);
    await userEvent.setup().click(screen.getByRole('button', { name: RETRY_LABEL }));

    expect(await screen.findByText('valor 3')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
