import { useRef, useState } from 'react';
import type { Role } from '../../../shared/domain/role';
import { defaultLayoutFor } from '../domain/defaultLayout';
import {
  addWidget,
  LayoutError,
  MAX_WIDGETS,
  moveWidget,
  removeWidget,
  resizeWidget,
  type DashboardLayout,
  type LayoutErrorReason,
  type WidgetDefinition,
  type WidgetSize,
} from '../domain/layout';

/** What the person reads when an edit breaks a layout rule; the domain throws, the editor says it. */
export const EDIT_MESSAGES: Readonly<Record<LayoutErrorReason, string>> = {
  'limit-reached': `O painel aceita no máximo ${MAX_WIDGETS} itens. Remova um item para adicionar outro.`,
  duplicate: 'Este item já está no painel.',
  'size-not-allowed': 'Este item não aceita esse tamanho.',
  'unknown-widget': 'Este item não está mais no painel.',
  'out-of-range': 'Não há essa posição no painel.',
};

export interface LayoutEditor {
  editing: boolean;
  /** The layout being edited; the saved one while the person is not editing. */
  draft: DashboardLayout;
  /** True when the draft differs from the saved layout, in widgets, order or sizes. */
  dirty: boolean;
  /** Why the last edit was refused, or `null`. */
  notice: string | null;
  start(): void;
  /** Leaves edit mode and drops the draft. */
  cancel(): void;
  /** Leaves edit mode once the draft became the saved layout (or the default took its place). */
  finish(): void;
  add(definition: WidgetDefinition): void;
  remove(id: string): void;
  move(id: string, toIndex: number): void;
  resize(definition: WidgetDefinition, size: WidgetSize): void;
  /** Replaces the draft with the default layout of the role; saving is a separate step. */
  resetDraft(): void;
}

const sameLayout = (a: DashboardLayout, b: DashboardLayout): boolean =>
  a.widgets.length === b.widgets.length && a.widgets.every((item, at) => item.id === b.widgets[at]?.id && item.size === b.widgets[at]?.size);

/**
 * The state of the "Personalizar" mode (LAY-03 to LAY-06): a draft copied from
 * the saved layout when editing starts, changed through the domain functions.
 * A change the domain refuses (a 21st widget, a repeated one) leaves the draft
 * as it was and sets `notice`, so the page never crashes on it.
 */
export function useLayoutEditor(role: Role, saved: DashboardLayout): LayoutEditor {
  const [draft, setDraftState] = useState<DashboardLayout | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Two edits in one event must build on each other, so the latest draft is kept outside the render.
  const latest = useRef<DashboardLayout | null>(null);

  function setDraft(next: DashboardLayout | null) {
    latest.current = next;
    setDraftState(next);
    setNotice(null);
  }

  function edit(change: (layout: DashboardLayout) => DashboardLayout) {
    if (!latest.current) return;
    try {
      setDraft(change(latest.current));
    } catch (error) {
      if (!(error instanceof LayoutError)) throw error;
      setNotice(EDIT_MESSAGES[error.reason]);
    }
  }

  const current = draft ?? saved;
  return {
    editing: draft !== null,
    draft: current,
    dirty: draft !== null && !sameLayout(draft, saved),
    notice,
    start: () => {
      if (!latest.current) setDraft(saved);
    },
    cancel: () => setDraft(null),
    finish: () => setDraft(null),
    add: (definition) => edit((layout) => addWidget(layout, definition)),
    remove: (id) => edit((layout) => removeWidget(layout, id)),
    move: (id, toIndex) => edit((layout) => moveWidget(layout, id, toIndex)),
    resize: (definition, size) => edit((layout) => resizeWidget(layout, definition, size)),
    resetDraft: () => edit(() => defaultLayoutFor(role)),
  };
}
