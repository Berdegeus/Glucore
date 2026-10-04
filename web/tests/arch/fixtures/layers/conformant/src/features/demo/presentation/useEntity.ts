import { useState } from 'react';
import { loadEntity } from '../application/loadEntity';
import type { Entity } from '../domain/entity';

export const useEntity = (read: () => Entity) => useState(() => loadEntity(read));
