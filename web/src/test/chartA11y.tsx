import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { expect } from 'vitest';
import { axe } from 'vitest-axe';
import { ChartFrame } from '../shared/presentation/charts/chartFrame';

/** A chart adapter inside `ChartFrame`, as a widget uses it, has no axe violations (RSP-07). */
export async function expectAccessibleInFrame(chart: ReactElement): Promise<void> {
  const { container } = render(
    <ChartFrame title="Gráfico" summary="Resumo do gráfico." columns={['Item', 'Valor']} rows={[['a', '1']]}>
      {chart}
    </ChartFrame>,
  );
  expect(await axe(container)).toHaveNoViolations();
}
