import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Role } from '../../../shared/domain/role';
import type { DashboardLayout } from '../domain/layout';
import { useLayoutServices } from './layoutServices';
import { layoutQueryKey } from './useLayout';
import type { LayoutEditor } from './useLayoutEditor';

export const SAVED_MESSAGE = 'Layout salvo';
export const RESTORED_MESSAGE = 'Layout padrão restaurado';
export const SAVE_ERROR = 'Não foi possível salvar o layout.';
export const RESET_ERROR = 'Não foi possível restaurar o layout padrão.';

export interface Failure {
  text: string;
  /** What to run again on "Tentar novamente"; it reads the draft as it is then. */
  action: 'save' | 'restore';
}

export interface LayoutActions {
  /** Success text to announce ("Layout salvo"), or `null`. */
  message: string | null;
  /** The last save or restore that failed, and which action to try again. */
  failure: Failure | null;
  busy: boolean;
  save(): Promise<void>;
  restore(): Promise<void>;
  /** Forgets the success text and the failure, as when a new edit starts. */
  clear(): void;
}

/**
 * Saves the draft (LAY-07) or restores the default (LAY-09) and puts the
 * outcome in the layout cache, so the page shows it without another request.
 * A failure changes nothing on screen but the error: the draft stays, and
 * trying the same action again uses the draft as it stands (LAY-13).
 */
export function useLayoutActions(role: Role, editor: LayoutEditor): LayoutActions {
  const { saveLayout, resetLayout } = useLayoutServices();
  const client = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: Failure['action'], work: () => Promise<DashboardLayout>, done: string) {
    setBusy(true);
    setMessage(null);
    setFailure(null);
    try {
      const layout = await work();
      client.setQueryData(layoutQueryKey(role), { layout, degraded: false });
      editor.finish();
      setMessage(done);
    } catch {
      setFailure({ text: action === 'save' ? SAVE_ERROR : RESET_ERROR, action });
    } finally {
      setBusy(false);
    }
  }

  return {
    message,
    failure,
    busy,
    save: () => run('save', () => saveLayout(editor.draft), SAVED_MESSAGE),
    restore: () => run('restore', () => resetLayout(role), RESTORED_MESSAGE),
    clear: () => {
      setMessage(null);
      setFailure(null);
    },
  };
}
