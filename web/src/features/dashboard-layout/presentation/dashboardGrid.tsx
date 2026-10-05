import type { ComponentPropsWithRef, HTMLAttributes, ReactNode } from 'react';
import type { WidgetSize } from '../domain/layout';
import styles from './dashboardGrid.module.css';

interface DashboardGridProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * The grid every dashboard sits on (RSP-01): 1, 2 or 4 columns by viewport
 * width, with the span of each cell decided by its `data-size` in the
 * stylesheet. It is generic on purpose: it knows cells and sizes, never
 * which widget fills a cell (ARQ-10), so adding a widget never touches it.
 */
export function DashboardGrid({ className, children, ...rest }: DashboardGridProps) {
  return (
    <div {...rest} className={className ? `${styles.grid} ${className}` : styles.grid}>
      {children}
    </div>
  );
}

interface GridItemProps extends ComponentPropsWithRef<'div'> {
  size: WidgetSize;
  children: ReactNode;
}

/** One cell of the grid; `size` becomes `data-size`, which the stylesheet turns into a column span. It takes a `ref`, for the editor to make the cell sortable. */
export function GridItem({ size, className, children, ...rest }: GridItemProps) {
  return (
    <div {...rest} data-size={size} className={className ? `${styles.item} ${className}` : styles.item}>
      {children}
    </div>
  );
}
