import type { Role } from '../../../shared/domain/role';
import { defaultLayoutFor } from '../domain/defaultLayout';
import type { DashboardLayout, WidgetDefinition } from '../domain/layout';
import { normalizeLayout } from '../domain/normalizeLayout';
import type { LayoutRepository } from '../domain/ports';

export interface LayoutUseCaseDeps {
  layouts: LayoutRepository;
  /** The widgets that exist right now. A function, so a widget registered late is still seen. */
  catalog: () => readonly WidgetDefinition[];
}

export interface LoadedLayout {
  layout: DashboardLayout;
  /** True when the saved layout could not be read and the default of the role stands in for it. */
  degraded: boolean;
}

export type LoadLayout = (role: Role) => Promise<LoadedLayout>;
export type SaveLayout = (layout: DashboardLayout) => Promise<DashboardLayout>;
export type ResetLayout = (role: Role) => Promise<DashboardLayout>;

export interface LayoutUseCases {
  loadLayout: LoadLayout;
  saveLayout: SaveLayout;
  resetLayout: ResetLayout;
}

/**
 * Loads the saved layout and cleans it against the catalog (LAY-10). With none
 * saved the default of the role applies (LAY-02). If the read fails the
 * dashboard still opens on the default, marked `degraded` so the page can say
 * the saved layout is out of reach; the person is never left with an empty screen.
 */
export function createLoadLayout({ layouts, catalog }: LayoutUseCaseDeps): LoadLayout {
  return async (role) => {
    try {
      const saved = await layouts.load();
      if (saved === null) return { layout: defaultLayoutFor(role), degraded: false };
      return { layout: normalizeLayout(saved, catalog(), role), degraded: false };
    } catch {
      return { layout: defaultLayoutFor(role), degraded: true };
    }
  };
}

/**
 * Stores the layout (LAY-07) and returns what the server kept. A failure
 * propagates as is, so the editor can keep the edited layout on screen and
 * offer another try (LAY-13).
 */
export function createSaveLayout({ layouts }: Pick<LayoutUseCaseDeps, 'layouts'>): SaveLayout {
  return (layout) => layouts.save(layout);
}

/** Deletes the saved layout and returns the default of the role to show in its place (LAY-09). */
export function createResetLayout({ layouts }: Pick<LayoutUseCaseDeps, 'layouts'>): ResetLayout {
  return async (role) => {
    await layouts.reset();
    return defaultLayoutFor(role);
  };
}

export function createLayoutUseCases(deps: LayoutUseCaseDeps): LayoutUseCases {
  return { loadLayout: createLoadLayout(deps), saveLayout: createSaveLayout(deps), resetLayout: createResetLayout(deps) };
}
