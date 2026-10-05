/// <reference types="node" />
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mockApi } from '../../../test/apiMocks';
import { mockLayoutStore } from '../../../test/layoutStore';
import { widgetDefinition } from '../../../test/layoutFakes';
import { renderOnContainer } from '../../../test/pageHarness';
import { loadPatientDashboardPage } from '../../patient-dashboard';
import type { WidgetProps } from './widgetRegistry';
import { allDefinitions, createWidgetRegistry, registerWidget } from './widgetRegistry';
import { DashboardGrid, GridItem } from './dashboardGrid';
import { registerWidgetTitles } from './widgetTitles';
import { WidgetSlot } from './widgetSlot';

// ARQ-10: a widget is one module and one `registerWidget` line. Nothing below edits the grid, the
// board or the page; the fake widget only enters through the registry API. (Vitest gives every test
// file its own module registry, so registering in the app registry here leaks into no other file.)

const FAKE_ID = 'fake-open-closed';
const FAKE_TITLE = 'Widget de prova';
const FAKE_TEXT = 'conteúdo do widget de prova';

/** The "new module": a component and nothing else. */
function FakeWidget({ size }: WidgetProps) {
  return <p>{`${FAKE_TEXT} (${size})`}</p>;
}

const fakeDefinition = () => widgetDefinition(FAKE_ID, { sizes: ['M', 'L'], defaultSize: 'M' });
/** The "one line of registration". */
const registerFake = () => registerWidget(fakeDefinition(), () => Promise.resolve({ default: FakeWidget }));

describe('a new widget through the generic grid (ARQ-10)', () => {
  it('shows up in a grid cell of its size from a registry that holds nothing else', async () => {
    const registry = createWidgetRegistry();
    registry.registerWidget(fakeDefinition(), () => Promise.resolve({ default: FakeWidget }));
    const component = registry.componentFor(FAKE_ID);
    if (!component) throw new Error('the fake widget was not registered');

    const { container } = render(
      <DashboardGrid>
        <GridItem size="L">
          <WidgetSlot component={component} size="L" />
        </GridItem>
      </DashboardGrid>,
    );

    expect(await screen.findByText(`${FAKE_TEXT} (L)`)).toBeInTheDocument();
    expect(container.querySelector('[data-size="L"]')).toContainElement(screen.getByText(`${FAKE_TEXT} (L)`));
    expect(registry.allDefinitions().map((definition) => definition.id)).toEqual([FAKE_ID]);
  });
});

describe('a new widget through the patient page (ARQ-10)', () => {
  registerFake();
  registerWidgetTitles({ [`widget.${FAKE_ID}`]: FAKE_TITLE });

  async function openPage(saved: { id: string; size: 'S' | 'M' | 'L' }[]) {
    mockApi();
    const store = mockLayoutStore(saved);
    const { default: Page } = await loadPatientDashboardPage();
    renderOnContainer(<Page />);
    return store;
  }

  it('is in the catalog of the role next to the real widgets, with no change to them', () => {
    const ids = allDefinitions().map((definition) => definition.id);

    expect(ids).toContain(FAKE_ID);
    expect(ids).toContain('kpi-tir');
  });

  it('is drawn by the page, at the size of the saved layout, when the layout lists it', async () => {
    await openPage([{ id: FAKE_ID, size: 'L' }]);

    const text = await screen.findByText(`${FAKE_TEXT} (L)`);

    expect(text.closest('[data-size]')).toHaveAttribute('data-size', 'L');
  });

  it('is offered by the editor, added to the draft and saved, like any other widget', async () => {
    const store = await openPage([]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Personalizar' }));

    await user.click(await screen.findByRole('button', { name: `Adicionar ${FAKE_TITLE}` }, { timeout: 10_000 }));
    expect(await screen.findByText(`${FAKE_TEXT} (M)`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(store.widgets).toEqual([{ id: FAKE_ID, size: 'M' }]));
    expect(await screen.findByText('Layout salvo')).toBeInTheDocument();
  });
});

describe('the grid, the board and the page name no widget (ARQ-10)', () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, path), 'utf8');
  const modules = {
    'the grid': read('dashboardGrid.tsx'),
    'the board': read('layoutBoard.tsx'),
    'the page': read('../../patient-dashboard/presentation/patientDashboardPage.tsx'),
  };

  it.each(Object.entries(modules))('%s imports no widget module, nor the catalog', (_name, source) => {
    expect(source).not.toMatch(/from\s+'[^']*\/widgets\//);
    expect(source).not.toMatch(/from\s+'[^']*widgetCatalog'/);
  });

  it.each(Object.entries(modules))('%s mentions no widget id', (_name, source) => {
    for (const { id } of allDefinitions()) expect(source, id).not.toContain(`'${id}'`);
  });

  it('the grid does not even import the registry', () => {
    expect(modules['the grid']).not.toMatch(/widgetRegistry/);
  });
});
