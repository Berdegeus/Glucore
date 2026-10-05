import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Role } from '../../../shared/domain/role';
import type { WidgetDefinition, WidgetSize } from '../domain/layout';

/** What the grid hands every widget. */
export interface WidgetProps {
  size: WidgetSize;
}

/** Loads a widget's module on demand: `() => import('./widgets/KpiTir')`. */
export type WidgetLoader = () => Promise<{ default: ComponentType<WidgetProps> }>;

export type WidgetComponent = LazyExoticComponent<ComponentType<WidgetProps>>;

export interface WidgetRegistry {
  /** Adds a widget; an id already registered throws. */
  registerWidget(definition: WidgetDefinition, loadComponent: WidgetLoader): void;
  /** The declared metadata of a widget, or `null` for an unknown id. */
  definitionFor(id: string): WidgetDefinition | null;
  /** The widget's component, loaded when it first renders, or `null` for an unknown id. */
  componentFor(id: string): WidgetComponent | null;
  /** Definitions a role may use, in registration order. */
  definitionsForRole(role: Role): WidgetDefinition[];
  /** Every registered definition, in registration order. */
  allDefinitions(): WidgetDefinition[];
}

interface Entry {
  definition: WidgetDefinition;
  component: WidgetComponent;
}

/**
 * Registry of widgets (ARQ-09, ARQ-10). `registerWidget` is also the Factory:
 * it wraps the loader in `React.lazy`, so a widget's code and its chart
 * library load only when the widget first renders. Adding a widget is one
 * module and one `registerWidget` line; the grid and the page never learn
 * which widgets exist.
 */
export function createWidgetRegistry(): WidgetRegistry {
  const entries = new Map<string, Entry>();

  return {
    registerWidget(definition, loadComponent) {
      if (entries.has(definition.id)) throw new Error(`Widget "${definition.id}" is already registered`);
      entries.set(definition.id, { definition, component: lazy(loadComponent) });
    },
    definitionFor: (id) => entries.get(id)?.definition ?? null,
    componentFor: (id) => entries.get(id)?.component ?? null,
    definitionsForRole: (role) => [...entries.values()].map((entry) => entry.definition).filter((definition) => definition.roles.includes(role)),
    allDefinitions: () => [...entries.values()].map((entry) => entry.definition),
  };
}

/** The registry the app uses; `widgetCatalog.ts` fills it, one line per widget. */
export const widgetRegistry: WidgetRegistry = createWidgetRegistry();

export const { registerWidget, definitionFor, componentFor, definitionsForRole, allDefinitions } = widgetRegistry;
