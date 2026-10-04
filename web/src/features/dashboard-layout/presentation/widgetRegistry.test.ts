import { render, screen } from '@testing-library/react';
import { createElement, Suspense, type ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Role } from '../../../shared/domain/role';
import { widgetDefinition } from '../../../test/layoutFakes';
import {
  createWidgetRegistry,
  definitionFor,
  registerWidget,
  widgetRegistry,
  type WidgetComponent,
  type WidgetLoader,
  type WidgetProps,
} from './widgetRegistry';

function loaderFor(text: string) {
  const Widget: ComponentType<WidgetProps> = ({ size }) => createElement('p', null, `${text} ${size}`);
  return vi.fn<WidgetLoader>(() => Promise.resolve({ default: Widget }));
}

function renderComponent(component: WidgetComponent | null) {
  if (!component) throw new Error('widget not registered');
  return render(createElement(Suspense, { fallback: 'loading' }, createElement(component, { size: 'M' })));
}

describe('widget registry (LAY-01, ARQ-09, ARQ-10)', () => {
  it('returns the definition it was given', () => {
    const registry = createWidgetRegistry();
    const definition = widgetDefinition('kpi-tir', { defaultSize: 'S' });

    registry.registerWidget(definition, loaderFor('TIR'));

    expect(registry.definitionFor('kpi-tir')).toBe(definition);
  });

  it('loads the component only when it first renders', async () => {
    const registry = createWidgetRegistry();
    const loader = loaderFor('TIR');
    registry.registerWidget(widgetDefinition('kpi-tir'), loader);

    const component = registry.componentFor('kpi-tir');
    expect(loader).not.toHaveBeenCalled();

    renderComponent(component);

    expect(await screen.findByText('TIR M')).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('returns the same component on every call, so React keeps its state between renders', () => {
    const registry = createWidgetRegistry();
    registry.registerWidget(widgetDefinition('kpi-tir'), loaderFor('TIR'));

    expect(registry.componentFor('kpi-tir')).toBe(registry.componentFor('kpi-tir'));
  });

  it('throws on a repeated id and keeps the first registration', () => {
    const registry = createWidgetRegistry();
    const first = widgetDefinition('kpi-tir');
    registry.registerWidget(first, loaderFor('first'));

    expect(() => registry.registerWidget(widgetDefinition('kpi-tir'), loaderFor('second'))).toThrow('kpi-tir');
    expect(registry.definitionFor('kpi-tir')).toBe(first);
  });

  it('answers null for an id nobody registered', () => {
    const registry = createWidgetRegistry();

    expect(registry.definitionFor('nope')).toBeNull();
    expect(registry.componentFor('nope')).toBeNull();
  });

  it('filters definitions by role, in registration order', () => {
    const registry = createWidgetRegistry();
    registry.registerWidget(widgetDefinition('b-patient'), loaderFor('b'));
    registry.registerWidget(widgetDefinition('a-pro', { roles: ['HEALTH_PROFESSIONAL'] }), loaderFor('a'));
    registry.registerWidget(widgetDefinition('c-both', { roles: ['PATIENT', 'ADMINISTRATOR'] }), loaderFor('c'));

    const idsFor = (role: Role) => registry.definitionsForRole(role).map((d) => d.id);

    expect(idsFor('PATIENT')).toEqual(['b-patient', 'c-both']);
    expect(idsFor('HEALTH_PROFESSIONAL')).toEqual(['a-pro']);
    expect(idsFor('ADMINISTRATOR')).toEqual(['c-both']);
  });

  it('lists every registered definition', () => {
    const registry = createWidgetRegistry();
    registry.registerWidget(widgetDefinition('one'), loaderFor('1'));
    registry.registerWidget(widgetDefinition('two', { roles: ['ADMINISTRATOR'] }), loaderFor('2'));

    expect(registry.allDefinitions().map((d) => d.id)).toEqual(['one', 'two']);
  });

  it('does not share entries between registries', () => {
    const first = createWidgetRegistry();
    first.registerWidget(widgetDefinition('only-here'), loaderFor('x'));

    expect(createWidgetRegistry().definitionFor('only-here')).toBeNull();
  });

  it('exposes the app registry through the module functions', () => {
    const definition = widgetDefinition('registry-test-widget');

    registerWidget(definition, loaderFor('app'));

    expect(definitionFor('registry-test-widget')).toBe(definition);
    expect(widgetRegistry.definitionFor('registry-test-widget')).toBe(definition);
  });
});
