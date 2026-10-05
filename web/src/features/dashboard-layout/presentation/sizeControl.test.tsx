import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { layoutOf, widgetDefinition } from '../../../test/layoutFakes';
import type { WidgetDefinition, WidgetSize } from '../domain/layout';
import { SizeControl } from './sizeControl';
import { useLayoutEditor } from './useLayoutEditor';

const group = () => screen.getByRole('group', { name: 'Tamanho: Alfa' });
const sizesOffered = () => within(group()).getAllByRole('radio').map((radio) => (radio as HTMLInputElement).labels?.[0]?.textContent);

/** The control over the editor draft, as the edit mode wires it, with the draft size written out. */
function Editing({ definition, initial }: { definition: WidgetDefinition; initial: WidgetSize }) {
  const editor = useLayoutEditor('PATIENT', layoutOf({ id: definition.id, size: initial }));
  const size = editor.draft.widgets[0]?.size ?? initial;
  return (
    <>
      <button type="button" onClick={editor.start}>
        iniciar
      </button>
      <SizeControl definition={definition} title="Alfa" value={size} onChange={(next) => editor.resize(definition, next)} />
      <p>{`rascunho: ${size}`}</p>
    </>
  );
}

async function editing(initial: WidgetSize) {
  const user = userEvent.setup();
  render(<Editing definition={widgetDefinition('a')} initial={initial} />);
  await user.click(screen.getByRole('button', { name: 'iniciar' }));
  return user;
}

describe('SizeControl (LAY-06)', () => {
  it('offers S, M and L to a widget that declares all three', () => {
    render(<SizeControl definition={widgetDefinition('a')} title="Alfa" value="M" onChange={vi.fn()} />);

    expect(sizesOffered()).toEqual(['S', 'M', 'L']);
  });

  it.each([
    [['S', 'M'], ['S', 'M']],
    [['L'], ['L']],
    [['M', 'S'], ['S', 'M']],
  ] as const)('offers only the sizes a widget declares (%j), in the order S, M, L', (declared, expected) => {
    render(<SizeControl definition={widgetDefinition('a', { sizes: declared, defaultSize: declared[0] })} title="Alfa" value={declared[0]} onChange={vi.fn()} />);

    expect(sizesOffered()).toEqual(expected);
  });

  it('checks the current size only', () => {
    render(<SizeControl definition={widgetDefinition('a')} title="Alfa" value="L" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'L' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'S' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'M' })).not.toBeChecked();
  });

  it('reports the size the person picks', async () => {
    const onChange = vi.fn();
    render(<SizeControl definition={widgetDefinition('a')} title="Alfa" value="M" onChange={onChange} />);

    await userEvent.setup().click(screen.getByRole('radio', { name: 'S' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('S');
  });

  it('changes the size with the arrow keys once the group has the focus', async () => {
    const user = await editing('S');

    await user.tab();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'M' })).toBeChecked();
  });

  it('changes the size in the draft of the editor', async () => {
    const user = await editing('S');
    expect(screen.getByText('rascunho: S')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'L' }));

    expect(screen.getByText('rascunho: L')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'L' })).toBeChecked();
  });

  it('has no axe violations', async () => {
    const { container } = render(<SizeControl definition={widgetDefinition('a')} title="Alfa" value="M" onChange={vi.fn()} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
