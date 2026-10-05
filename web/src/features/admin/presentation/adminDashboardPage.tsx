import { useState } from 'react';
import { LayoutBoard, LayoutEditorProvider, LayoutToolbar } from '../../dashboard-layout';
import { DEFAULT_ADMIN_DAYS } from '../application/adminUseCases';
import styles from './adminDashboardPage.module.css';
import { AdminPeriodProvider } from './adminPeriodContext';
import { AdminPeriodFilter } from './adminPeriodFilter';

export const PAGE_TITLE = 'Painel da plataforma';

/**
 * The administrator's dashboard (ADM-01, ADM-07, LAY-03): the period filter, "Personalizar"
 * and the grid of the widgets the layout lists. It opens on the last 30 days; the period
 * lives here and reaches the widgets through `AdminPeriodProvider`, so all of them share
 * one overview request per period.
 */
export function AdminDashboardPage() {
  const [days, setDays] = useState<number>(DEFAULT_ADMIN_DAYS);
  return (
    <AdminPeriodProvider days={days}>
      <LayoutEditorProvider forRole="ADMINISTRATOR">
        <div className={styles.page}>
          <h1 className={styles.title}>{PAGE_TITLE}</h1>
          <div className={styles.toolbar}>
            <AdminPeriodFilter value={days} onChange={setDays} />
            <LayoutToolbar />
          </div>
          <LayoutBoard />
        </div>
      </LayoutEditorProvider>
    </AdminPeriodProvider>
  );
}
