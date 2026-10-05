import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { mockApi } from '../../../test/apiMocks';
import { API_BASE } from '../../../test/httpClient';
import { widgetDefinition } from '../../../test/layoutFakes';
import { mockLayoutStore } from '../../../test/layoutStore';
import { renderOnContainer } from '../../../test/pageHarness';
import { server } from '../../../test/server';
import { defaultLayoutFor } from '../domain/defaultLayout';
import { useLayoutEditorContext, LayoutEditorProvider } from './layoutEditorContext';
import {
  CANCEL_EDIT_LABEL,
  CUSTOMIZE_LABEL,
  LayoutToolbar,
  RESTORE_CONFIRM_LABEL,
  RESTORE_LABEL,
  RESTORE_MESSAGE,
  RESTORE_TITLE,
  SAVE_LABEL,
} from './layoutToolbar';
import { EDIT_MESSAGES } from './useLayoutEditor';
import { RESET_ERROR, RESTORED_MESSAGE, SAVED_MESSAGE, SAVE_ERROR } from './useLayoutActions';
import { registerWidget } from './widgetRegistry';
import { RETRY_LABEL } from '../../../shared/presentation/ui/states';

const NO_COMPONENT = () => Promise.resolve({ default: () => null });
const SAVED = [
  { id: 'kpi-a', size: 'S' },
  { id: 'kpi-b', size: 'S' },
  { id: 'kpi-c', size: 'S' },
] as const;
for (const { id } of SAVED) registerWidget(widgetDefinition(id), NO_COMPONENT);

/** Shows the draft and the saved layout as text, with buttons that edit the draft, next to the toolbar. */
function Probe() {
  const { editor, layout } = useLayoutEditorContext();
  const ids = (widgets: readonly { id: string }[]) => widgets.map((item) => item.id).join(',');
  return (
    <div>
      <p data-testid="draft">{ids(editor.draft.widgets)}</p>
      <p data-testid="saved">{layout ? ids(layout.widgets) : 'loading'}</p>
      <button type="button" onClick={() => editor.remove('kpi-a')}>
        remover A
      </button>
      <button type="button" onClick={() => editor.add(widgetDefinition('kpi-b'))}>
        repetir B
      </button>
    </div>
  );
}

async function setup(saved: typeof SAVED | null = SAVED) {
  mockApi();
  const store = mockLayoutStore(saved ? saved.map((item) => ({ ...item })) : null);
  const { container } = renderOnContainer(
    <main>
      <LayoutEditorProvider forRole="PATIENT">
        <LayoutToolbar />
        <Probe />
      </LayoutEditorProvider>
    </main>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: CUSTOMIZE_LABEL }));
  return { user, store, container };
}

const draft = () => screen.getByTestId('draft').textContent;
const saved = () => screen.getByTestId('saved').textContent;
const button = (name: string) => screen.getByRole('button', { name });

describe('LayoutToolbar edit mode (LAY-03)', () => {
  it('shows only "Personalizar" before editing, and nothing while the layout loads', async () => {
    mockApi();
    mockLayoutStore([...SAVED]);
    renderOnContainer(
      <LayoutEditorProvider forRole="PATIENT">
        <LayoutToolbar />
      </LayoutEditorProvider>,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: CUSTOMIZE_LABEL })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('swaps it for "Salvar", "Cancelar" and "Restaurar padrão" when editing starts, with the focus on "Cancelar"', async () => {
    await setup();

    expect(screen.queryByRole('button', { name: CUSTOMIZE_LABEL })).not.toBeInTheDocument();
    expect(button(SAVE_LABEL)).toBeDisabled();
    expect(button(RESTORE_LABEL)).toBeEnabled();
    expect(button(CANCEL_EDIT_LABEL)).toHaveFocus();
  });

  it('enables "Salvar" once the draft differs from the saved layout', async () => {
    const { user } = await setup();

    await user.click(button('remover A'));

    expect(button(SAVE_LABEL)).toBeEnabled();
  });

  it('drops the draft on "Cancelar" and puts the focus back on "Personalizar"', async () => {
    const { user } = await setup();
    await user.click(button('remover A'));
    expect(draft()).toBe('kpi-b,kpi-c');

    await user.click(button(CANCEL_EDIT_LABEL));

    expect(saved()).toBe('kpi-a,kpi-b,kpi-c');
    expect(draft()).toBe('kpi-a,kpi-b,kpi-c');
    expect(button(CUSTOMIZE_LABEL)).toHaveFocus();
  });

  it('says why an edit was refused', async () => {
    const { user } = await setup();

    await user.click(button('repetir B'));

    expect(screen.getByRole('alert')).toHaveTextContent(EDIT_MESSAGES.duplicate);
  });
});

describe('LayoutToolbar save (LAY-07, LAY-13)', () => {
  it('saves the draft, says "Layout salvo" and leaves the edit mode', async () => {
    const { user, store } = await setup();
    await user.click(button('remover A'));

    await user.click(button(SAVE_LABEL));

    expect(await screen.findByText('Layout salvo')).toBeInTheDocument();
    expect(SAVED_MESSAGE).toBe('Layout salvo');
    expect(store.puts).toEqual([[{ id: 'kpi-b', size: 'S' }, { id: 'kpi-c', size: 'S' }]]);
    expect(saved()).toBe('kpi-b,kpi-c');
    expect(screen.getByRole('status')).toHaveTextContent('Layout salvo');
    expect(button(CUSTOMIZE_LABEL)).toHaveFocus();
  });

  it('forgets "Layout salvo" when a new edit starts', async () => {
    const { user } = await setup();
    await user.click(button('remover A'));
    await user.click(button(SAVE_LABEL));
    await screen.findByText('Layout salvo');

    await user.click(button(CUSTOMIZE_LABEL));

    expect(screen.queryByText('Layout salvo')).not.toBeInTheDocument();
  });

  it('keeps the draft, shows the error and offers to try again when the save fails', async () => {
    const { user, store } = await setup();
    store.failSaveWith = 503;
    await user.click(button('remover A'));

    await user.click(button(SAVE_LABEL));

    const alert = await screen.findByText(SAVE_ERROR);
    expect(SAVE_ERROR).toBe('Não foi possível salvar o layout.');
    expect(alert.closest('[role="alert"]')).toContainElement(button(RETRY_LABEL));
    expect(draft()).toBe('kpi-b,kpi-c');
    expect(saved()).toBe('kpi-a,kpi-b,kpi-c');
    expect(button(SAVE_LABEL)).toBeEnabled();
    expect(screen.queryByText('Layout salvo')).not.toBeInTheDocument();
  });

  it('saves on "Tentar novamente" once the server answers, with the draft as it is by then', async () => {
    const { user, store } = await setup();
    store.failSaveWith = 503;
    await user.click(button('remover A'));
    await user.click(button(SAVE_LABEL));
    await screen.findByText(SAVE_ERROR);
    store.failSaveWith = null;

    await user.click(button(RETRY_LABEL));

    expect(await screen.findByText('Layout salvo')).toBeInTheDocument();
    expect(store.puts).toHaveLength(2);
    expect(store.widgets).toEqual([{ id: 'kpi-b', size: 'S' }, { id: 'kpi-c', size: 'S' }]);
    expect(screen.queryByText(SAVE_ERROR)).not.toBeInTheDocument();
  });
});

describe('LayoutToolbar restore (LAY-09)', () => {
  it('asks before restoring, with the focus on "Cancelar", and changes nothing yet', async () => {
    const { user, store } = await setup();

    await user.click(button(RESTORE_LABEL));

    const dialog = screen.getByRole('alertdialog', { name: RESTORE_TITLE });
    expect(dialog).toHaveAccessibleDescription(RESTORE_MESSAGE);
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(store.deletes).toBe(0);
  });

  it('closes on Esc and on "Cancelar" without deleting, and gives the focus back to the button that asked', async () => {
    const { user, store } = await setup();
    await user.click(button(RESTORE_LABEL));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(button(RESTORE_LABEL)).toHaveFocus();

    await user.click(button(RESTORE_LABEL));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(button(RESTORE_LABEL)).toHaveFocus();
    expect(store.deletes).toBe(0);
    expect(saved()).toBe('kpi-a,kpi-b,kpi-c');
  });

  it('keeps the focus between the two buttons of the dialog', async () => {
    const { user } = await setup();
    await user.click(button(RESTORE_LABEL));
    const dialog = within(screen.getByRole('alertdialog'));

    await user.tab();
    expect(dialog.getByRole('button', { name: RESTORE_CONFIRM_LABEL })).toHaveFocus();
    await user.tab();
    expect(dialog.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(dialog.getByRole('button', { name: RESTORE_CONFIRM_LABEL })).toHaveFocus();
  });

  it('deletes the saved layout and shows the default of the role once confirmed', async () => {
    const { user, store } = await setup();

    await user.click(button(RESTORE_LABEL));
    await user.click(button(RESTORE_CONFIRM_LABEL));

    expect(await screen.findByText(RESTORED_MESSAGE)).toBeInTheDocument();
    expect(store.deletes).toBe(1);
    expect(store.widgets).toBeNull();
    expect(saved()).toBe(defaultLayoutFor('PATIENT').widgets.map((item) => item.id).join(','));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(button(CUSTOMIZE_LABEL)).toHaveFocus();
  });

  it('keeps everything and shows the error when the delete fails', async () => {
    const { user } = await setup();
    server.use(http.delete(`${API_BASE}/preferences/dashboard`, () => HttpResponse.json({ error: 'down' }, { status: 503 })));
    await user.click(button('remover A'));

    await user.click(button(RESTORE_LABEL));
    await user.click(button(RESTORE_CONFIRM_LABEL));

    expect(await screen.findByText(RESET_ERROR)).toBeInTheDocument();
    expect(draft()).toBe('kpi-b,kpi-c');
    expect(saved()).toBe('kpi-a,kpi-b,kpi-c');
    expect(screen.queryByText(RESTORED_MESSAGE)).not.toBeInTheDocument();
  });
});

describe('LayoutToolbar accessibility (RSP-06)', () => {
  it('has no axe violations while editing, with the question open and with an error shown', async () => {
    const { user, store, container: html } = await setup();
    expect(await axe(html)).toHaveNoViolations();

    await user.click(button(RESTORE_LABEL));
    expect(await axe(html)).toHaveNoViolations();

    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    store.failSaveWith = 503;
    await user.click(button('remover A'));
    await user.click(button(SAVE_LABEL));
    await screen.findByText(SAVE_ERROR);
    expect(await axe(html)).toHaveNoViolations();
  });
});
