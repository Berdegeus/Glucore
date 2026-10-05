import { loadEntity } from '../features/demo/application/loadEntity';
import { readEntity } from '../features/demo/infrastructure/entityRepository';
import { useEntity } from '../features/demo/presentation/useEntity';

export const container = { load: () => loadEntity(readEntity), useEntity };
