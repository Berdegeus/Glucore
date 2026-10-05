import { createContext, useContext, type ReactNode } from 'react';
import type { Role } from '../../../shared/domain/role';
import type { DashboardLayout } from '../domain/layout';
import { useLayout } from './useLayout';
import { useLayoutEditor, type LayoutEditor } from './useLayoutEditor';

const NO_WIDGETS: DashboardLayout = { widgets: [] };

export interface LayoutEditorContextValue {
  role: Role;
  /** True until the first layout of the role has loaded. */
  loading: boolean;
  /** The saved layout, or the default while the saved one is out of reach (LAY-02). */
  layout: DashboardLayout | null;
  editor: LayoutEditor;
}

const LayoutEditorContext = createContext<LayoutEditorContextValue | null>(null);

/**
 * Loads the layout of `role` and keeps the editor state for everything below
 * it: the toolbar and the board share one draft. A page of any role wraps its
 * toolbar and board in it; it knows nothing about which widgets exist.
 */
export function LayoutEditorProvider({ forRole, children }: { forRole: Role; children: ReactNode }) {
  const { layout, isLoading } = useLayout(forRole);
  const editor = useLayoutEditor(forRole, layout ?? NO_WIDGETS);
  return <LayoutEditorContext.Provider value={{ role: forRole, loading: isLoading, layout, editor }}>{children}</LayoutEditorContext.Provider>;
}

export function useLayoutEditorContext(): LayoutEditorContextValue {
  const value = useContext(LayoutEditorContext);
  if (!value) throw new Error('The layout editor needs a LayoutEditorProvider above it');
  return value;
}
