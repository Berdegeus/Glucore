import { expect, it } from 'vitest';
import type { Entity } from './entity';

it('has an id', () => {
  const entity: Entity = { id: '1' };
  expect(entity.id).toBe('1');
});
