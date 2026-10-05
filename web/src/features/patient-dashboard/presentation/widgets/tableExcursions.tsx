import { browserTimeZone } from '../../../../shared/presentation/browserTimeZone';
import type { Excursion } from '../../domain/summary';
import { defineSummaryWidget } from './defineSummaryWidget';
import { excursionCells, EXCURSIONS_COLUMNS } from './excursionsModel';
import styles from './tableExcursions.module.css';
import { TABLE_EXCURSIONS_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { tableExcursionsDefinition } from './tableExcursions.definition';

export { TABLE_EXCURSIONS_TITLE };

/** The cause when the period has no episode, with or without readings: that is no failure. */
export const NO_EXCURSIONS_CAUSE = 'Nenhum episódio no período';

/** Accessible name of the part that scrolls, so a keyboard user can focus and scroll it. */
export const EXCURSIONS_SCROLL_LABEL = 'Tabela de episódios, role para ver todas as colunas';

const KIND_CLASS = { HYPO: styles.hypo, HYPER: styles.hyper } as const;

function ExcursionsTable({ excursions }: { excursions: readonly Excursion[] }) {
  const timeZone = browserTimeZone();
  return (
    // A scrollable region must take focus, or a keyboard cannot reach the columns it hides.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the scroll area is the control that needs the keyboard
    <div className={styles.scroll} role="region" aria-label={EXCURSIONS_SCROLL_LABEL} tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.hidden}>{TABLE_EXCURSIONS_TITLE}</caption>
        <thead>
          <tr>
            {EXCURSIONS_COLUMNS.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {excursions.map((excursion) => (
            <tr key={`${excursion.kind}-${excursion.startedAt}`}>
              {excursionCells(excursion, timeZone).map((cell, index) => (
                <td key={EXCURSIONS_COLUMNS[index]} className={index === 0 ? KIND_CLASS[excursion.kind] : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every hypo and hyperglycemia episode of the period, with start, duration, minimum and maximum (PAC-08). */
export default defineSummaryWidget({
  title: TABLE_EXCURSIONS_TITLE,
  isEmpty: (summary) => summary.excursions.length === 0,
  emptyCause: NO_EXCURSIONS_CAUSE,
  render: (summary) => <ExcursionsTable excursions={summary.excursions} />,
});
