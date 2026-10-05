import { render, screen } from '@testing-library/react';
import { createElement, type ComponentType } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { widgetDefinition } from '../../../test/layoutFakes';
import { RETRY_LABEL } from '../../../shared/presentation/ui/states';
import { createWidgetRegistry, type WidgetLoader, type WidgetProps } from './widgetRegistry';
import { SKELETON_HEIGHT } from './widgetShell';
import { UNAVAILABLE_WIDGET_MESSAGE, UNAVAILABLE_WIDGET_TITLE, WidgetSlot } from './widgetSlot';

const Working: ComponentType<WidgetProps> = ({ size }) => createElement('p', null, `Pronto ${size}`);

function slotOf(loader: WidgetLoader, size: 'S' | 'M' | 'L' = 'M') {
  const registry = createWidgetRegistry();
  registry.registerWidget(widgetDefinition('w'), loader);
  const component = registry.componentFor('w');
  if (!component) throw new Error('not registered');
  return <WidgetSlot component={component} size={size} />;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('WidgetSlot (LAY-15, LAY-16)', () => {
  it('shows a skeleton of the widget size while its code loads, then the widget with its size', async () => {
    render(slotOf(() => Promise.resolve({ default: Working }), 'L'));

    expect(screen.getByRole('status', { name: 'Carregando' })).toHaveStyle({ height: SKELETON_HEIGHT.L });
    expect(await screen.findByText('Pronto L')).toBeInTheDocument();
  });

  it('fails only its own cell when the code cannot load, and offers a reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <>
        {slotOf(() => Promise.reject(new Error('chunk gone')))}
        <p>Vizinho</p>
      </>,
    );

    expect(await screen.findByRole('heading', { name: UNAVAILABLE_WIDGET_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(UNAVAILABLE_WIDGET_MESSAGE);
    expect(screen.getByRole('button', { name: RETRY_LABEL })).toBeInTheDocument();
    expect(screen.getByText('Vizinho')).toBeInTheDocument();
  });

  it('reloads the page on "Tentar novamente", since a rejected load stays rejected', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(slotOf(() => Promise.reject(new Error('chunk gone'))));

    await userEvent.setup().click(await screen.findByRole('button', { name: RETRY_LABEL }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
