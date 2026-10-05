import { useState } from 'react';
import { DaysFilter } from '../../../shared/presentation/ui/daysFilter';
import { LayoutBoard, LayoutEditorProvider, LayoutToolbar } from '../../dashboard-layout';
import { PORTFOLIO_PERIOD_DAYS } from '../domain/cohort';
import { NoLinksPanel } from './noLinksPanel';
import { ProfessionalPeriodProvider } from './periodContext';
import styles from './professionalDashboardPage.module.css';
import { RevokedAccessNotice } from './revokedAccessNotice';

export const PAGE_TITLE = 'Meus pacientes';
export const PERIOD_GROUP_LABEL = 'Período';
export const DEFAULT_DAYS = 14;

/**
 * The professional's portfolio (PRO-01, PRO-05): the period filter, "Personalizar"
 * and the grid of the widgets the layout lists. It opens on the last 14 days; the
 * period lives here and reaches the widgets through `ProfessionalPeriodProvider`,
 * so all of them share one cohort and one list request per period. With no
 * linked patient the panel above the grid says how to get a code; the grid keeps
 * working. The page must sit under a `RevokedAccessProvider`, which the routes give it.
 */
export function ProfessionalDashboardPage() {
  const [days, setDays] = useState(DEFAULT_DAYS);
  return (
    <ProfessionalPeriodProvider days={days}>
      <LayoutEditorProvider forRole="HEALTH_PROFESSIONAL">
        <div className={styles.page}>
          <h1 className={styles.title}>{PAGE_TITLE}</h1>
          <RevokedAccessNotice />
          <div className={styles.toolbar}>
            <DaysFilter options={PORTFOLIO_PERIOD_DAYS} value={days} onChange={setDays} label={PERIOD_GROUP_LABEL} />
            <LayoutToolbar />
          </div>
          <NoLinksPanel />
          <LayoutBoard />
        </div>
      </LayoutEditorProvider>
    </ProfessionalPeriodProvider>
  );
}
