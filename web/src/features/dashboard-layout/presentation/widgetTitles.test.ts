import { describe, expect, it } from 'vitest';
import { widgetDefinition } from '../../../test/layoutFakes';
import { registerWidgetTitles, widgetTitle } from './widgetTitles';

describe('widget titles', () => {
  it('resolves the text registered for the title key of a definition', () => {
    registerWidgetTitles({ 'widget.titled': 'Tempo no alvo' });

    expect(widgetTitle(widgetDefinition('titled'))).toBe('Tempo no alvo');
  });

  it('falls back to the id while no text is registered', () => {
    expect(widgetTitle(widgetDefinition('untitled'))).toBe('untitled');
  });

  it('lets a later registration replace the text of a key', () => {
    registerWidgetTitles({ 'widget.renamed': 'Antes' });
    registerWidgetTitles({ 'widget.renamed': 'Depois' });

    expect(widgetTitle(widgetDefinition('renamed'))).toBe('Depois');
  });
});
