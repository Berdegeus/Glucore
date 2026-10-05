import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { layoutOfIds, widgetDefinition } from '../../../test/layoutFakes';
import { PICKER_EMPTY, PICKER_TITLE, RemoveWidgetButton, WidgetPicker } from './widgetPicker';
import { registerWidget } from './widgetRegistry';
import { registerWidgetTitles, widgetTitle } from './widgetTitles';
import { useLayoutEditor } from './useLayoutEditor';

const NO_COMPONENT = () => Promise.resolve({ default: () => null });
const PATIENT_WIDGETS = ['kpi-a', 'kpi-b', 'chart-c'];

for (const id of PATIENT_WIDGETS) registerWidget(widgetDefinition(id), NO_COMPONENT);
registerWidget(widgetDefinition('pro-only', { roles: ['HEALTH_PROFESSIONAL'] }), NO_COMPONENT);
registerWidgetTitles({ 'widget.kpi-a': 'Indicador A', 'widget.kpi-b': 'Indicador B', 'widget.chart-c': 'Gráfico C', 'widget.pro-only': 'Só profissional' });

const offered = () =>
  within(within(screen.getByRole('region', { name: PICKER_TITLE })).getByRole('list'))
    .getAllByRole('listitem')
    .map((entry) => entry.querySelector('span')?.textContent);
const onDashboard = () => within(screen.getByRole('list', { name: 'no painel' })).getAllByRole('listitem').map((entry) => entry.firstChild?.textContent);

/** The picker and a remove button per widget, over the editor state, the way the edit mode wires them. */
function Harness({ initial }: { initial: string[] }) {
  const editor = useLayoutEditor('PATIENT', layoutOfIds(...initial));
  return (
    <div>
      <button type="button" onClick={editor.start}>
        iniciar
      </button>
      <WidgetPicker forRole="PATIENT" draft={editor.draft} onAdd={editor.add} />
      <ul aria-label="no painel">
        {editor.draft.widgets.map((item) => (
          <li key={item.id}>
            {item.id}
            <RemoveWidgetButton title={widgetTitle(widgetDefinition(item.id))} onRemove={() => editor.remove(item.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

async function started(initial: string[]) {
  const user = userEvent.setup();
  const view = render(<Harness initial={initial} />);
  await user.click(screen.getByRole('button', { name: 'iniciar' }));
  return { user, ...view };
}

describe('WidgetPicker (LAY-03)', () => {
  it('offers only the widgets of the role that are not on the dashboard, by title', () => {
    render(<WidgetPicker forRole="PATIENT" draft={layoutOfIds('kpi-a')} onAdd={vi.fn()} />);

    expect(screen.getByRole('heading', { name: PICKER_TITLE })).toBeInTheDocument();
    expect(offered()).toEqual(['Indicador B', 'Gráfico C']);
    expect(screen.queryByText('Só profissional')).not.toBeInTheDocument();
  });

  it('offers the widgets of another role from the same registry', () => {
    render(<WidgetPicker forRole="HEALTH_PROFESSIONAL" draft={layoutOfIds()} onAdd={vi.fn()} />);

    expect(offered()).toEqual(['Só profissional']);
  });

  it('says so when every widget is already on the dashboard', () => {
    render(<WidgetPicker forRole="PATIENT" draft={layoutOfIds(...PATIENT_WIDGETS)} onAdd={vi.fn()} />);

    expect(screen.getByText(PICKER_EMPTY)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('adds a widget to the draft and stops offering it', async () => {
    const { user } = await started(['kpi-a']);

    await user.click(screen.getByRole('button', { name: 'Adicionar Gráfico C' }));

    expect(onDashboard()).toEqual(['kpi-a', 'chart-c']);
    expect(offered()).toEqual(['Indicador B']);
  });

  it('removes a widget from the draft and offers it again', async () => {
    const { user } = await started(['kpi-a', 'kpi-b']);

    await user.click(screen.getByRole('button', { name: 'Remover Indicador A' }));

    expect(onDashboard()).toEqual(['kpi-b']);
    expect(offered()).toEqual(['Indicador A', 'Gráfico C']);
  });

  it('names each button after its widget', () => {
    render(<WidgetPicker forRole="PATIENT" draft={layoutOfIds()} onAdd={vi.fn()} />);

    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Adicionar Indicador A',
      'Adicionar Indicador B',
      'Adicionar Gráfico C',
    ]);
  });

  it('has no axe violations, with the list and with the empty message', async () => {
    const view = render(<WidgetPicker forRole="PATIENT" draft={layoutOfIds('kpi-a')} onAdd={vi.fn()} />);
    expect(await axe(view.container)).toHaveNoViolations();

    view.rerender(<WidgetPicker forRole="PATIENT" draft={layoutOfIds(...PATIENT_WIDGETS)} onAdd={vi.fn()} />);
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
