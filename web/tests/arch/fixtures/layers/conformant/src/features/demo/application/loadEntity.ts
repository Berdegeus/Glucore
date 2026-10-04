import type { Entity } from '../domain/entity';

export const loadEntity = (read: () => Entity): Entity => read();
