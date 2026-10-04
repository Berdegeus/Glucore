import { useId, useState, type ReactNode } from 'react';
import styles from './chartFrame.module.css';

export const TABLE_TOGGLE_LABEL = 'Ver como tabela';

interface ChartFrameProps {
  title: string;
  /** One sentence for screen readers: what the chart shows (RSP-07). */
  summary: string;
  /** Header cells of the table view; the same series the chart draws. */
  columns: readonly string[];
  /** Body of the table view, already formatted for display (pt-BR, RSP-09). */
  rows: ReadonlyArray<readonly string[]>;
  children: ReactNode;
}

function DataTable({ title, columns, rows }: Pick<ChartFrameProps, 'title' | 'columns' | 'rows'>) {
  return (
    <table className={styles.table}>
      <caption className={styles.hidden}>{title}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          // Rows have no identity of their own; the table is rebuilt whole when the data changes.
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Title, text summary and the "Ver como tabela" alternative around any chart
 * adapter (RSP-07). The chart is one image to assistive technology; the table
 * view exposes the same data cell by cell.
 */
export function ChartFrame({ title, summary, columns, rows, children }: ChartFrameProps) {
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  return (
    <figure className={styles.frame} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h3 id={titleId} className={styles.title}>
          {title}
        </h3>
        <button type="button" className={styles.toggle} aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {TABLE_TOGGLE_LABEL}
        </button>
      </div>
      {asTable ? (
        <DataTable title={title} columns={columns} rows={rows} />
      ) : (
        <div className={styles.chart} role="img" aria-label={summary}>
          {children}
        </div>
      )}
    </figure>
  );
}
