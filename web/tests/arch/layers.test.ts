import { describe, expect, it } from 'vitest';
import { violationsIn } from './cruise';

// ARQ-02 / ARQ-03: `npm run lint:arch` fails when a layer imports what the
// design's dependency table forbids. Each fixture breaks exactly one rule.

describe('layer rule (dependency-cruiser)', () => {
  it('rejects domain importing an npm package', async () => {
    expect(await violationsIn('layers/domain-imports-npm')).toEqual([
      { rule: 'domain-no-npm', from: 'src/features/demo/domain/entity.ts', to: 'react' },
    ]);
  });

  it('rejects domain importing application', async () => {
    expect(await violationsIn('layers/domain-imports-application')).toEqual([
      {
        rule: 'domain-no-outer-layers',
        from: 'src/features/demo/domain/entity.ts',
        to: 'src/features/demo/application/loadEntity.ts',
      },
    ]);
  });

  it('rejects application importing infrastructure', async () => {
    expect(await violationsIn('layers/application-imports-infrastructure')).toEqual([
      {
        rule: 'application-no-outer-layers',
        from: 'src/features/demo/application/loadEntity.ts',
        to: 'src/features/demo/infrastructure/entityRepository.ts',
      },
    ]);
  });

  it('rejects presentation importing infrastructure', async () => {
    expect(await violationsIn('layers/presentation-imports-infrastructure')).toEqual([
      {
        rule: 'presentation-no-infrastructure',
        from: 'src/features/demo/presentation/useEntity.ts',
        to: 'src/features/demo/infrastructure/entityRepository.ts',
      },
    ]);
  });

  it('accepts a tree that follows the rule, composition root included', async () => {
    expect(await violationsIn('layers/conformant')).toEqual([]);
  });
});
