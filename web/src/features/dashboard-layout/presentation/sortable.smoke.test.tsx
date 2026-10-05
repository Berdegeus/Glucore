import { closestCenter, DndContext, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Spike (LAY-04): @dnd-kit/core + @dnd-kit/sortable work with this project's
// React. Three items are reordered with the keyboard sensor, the same path a
// pointer drag takes through onDragEnd.

const ROW_HEIGHT = 50;

function Item({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef } = useSortable({ id });
  return (
    <li ref={setNodeRef} data-testid="item" {...attributes} {...listeners}>
      {id}
    </li>
  );
}

function SortableList() {
  const [items, setItems] = useState(['A', 'B', 'C']);
  const sensors = useSensors(useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setItems((current) => arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id))));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ul aria-label="Widgets">
          {items.map((id) => (
            <Item key={id} id={id} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

const order = () => within(screen.getByRole('list', { name: 'Widgets' })).getAllByTestId('item').map((li) => li.textContent);

// The keyboard sensor binds its move/drop listener on the next macrotask, so
// each key press yields once before the next one.
const press = (element: Element, code: string) =>
  act(async () => {
    fireEvent.keyDown(element, { code, key: code });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('@dnd-kit sortable with React 19 (spike)', () => {
  // jsdom has no layout: give each list item a stacked rect so the sensor can
  // measure where the neighbours are.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = this.tagName === 'LI' ? Array.from(this.parentElement?.children ?? []).indexOf(this) : 0;
      const top = index * ROW_HEIGHT;
      return { x: 0, y: top, top, left: 0, width: 200, height: ROW_HEIGHT - 10, right: 200, bottom: top + ROW_HEIGHT - 10, toJSON: () => ({}) };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reorders three items with the keyboard sensor', async () => {
    render(<SortableList />);
    expect(order()).toEqual(['A', 'B', 'C']);

    const first = screen.getByText('A');
    first.focus();
    await press(first, 'Space');
    await press(first, 'ArrowDown');
    await press(first, 'Space');

    expect(order()).toEqual(['B', 'A', 'C']);
  });
});
