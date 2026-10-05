import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DashboardGrid, GridItem, WidgetSlot, componentFor, defaultLayoutFor } from '../../dashboard-layout';
import {
  DEFAULT_PRESET,
  PeriodFilter,
  PeriodProvider,
  SummaryScopeProvider,
  toRange,
  todayInBrowserZone,
  useSummary,
  type DateRange,
} from '../../patient-dashboard';
import styles from './patientDetailPage.module.css';
import { usePatientName } from './usePatientName';
import { useRevokedAccessNotice } from './revokedAccess';

export const BACK_LABEL = 'Voltar à carteira';
export const PATIENT_NOT_FOUND_TITLE = 'Página não encontrada';
const PORTFOLIO_PATH = '/profissional';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Day detail reads the diary through `/readings`, `/carbs` and `/insulin`, which only answer for the signed-in person.
// The professional has no diary endpoint for a linked patient, so the card would show the professional's own empty diary.
const WITHOUT_DIARY = 'chart-day-detail';

/** The cards of the patient's default layout the professional can read: every one but the diary-based day detail. */
const PATIENT_CARDS = defaultLayoutFor('PATIENT').widgets.filter((item) => item.id !== WITHOUT_DIARY);

/**
 * Leaves for the portfolio when the patient has revoked the link (PRO-13): the
 * summary every widget shares answers `403 NO_ACTIVE_GRANT`, the notice is set
 * and the professional lands where it is shown. Any other error stays in the
 * widgets' own error states. It reads the widgets' summary, so it costs no request.
 */
function LeaveWhenRevoked({ patientId, range }: { patientId: string; range: DateRange }) {
  const { error } = useSummary(range);
  const { handleError } = useRevokedAccessNotice();
  const navigate = useNavigate();
  useEffect(() => {
    if (error && handleError(error, patientId)) void navigate(PORTFOLIO_PATH, { replace: true });
  }, [error, handleError, navigate, patientId]);
  return null;
}

function PatientCards() {
  return (
    <DashboardGrid>
      {PATIENT_CARDS.flatMap((item) => {
        const component = componentFor(item.id);
        return component
          ? [
              <GridItem key={item.id} size={item.size}>
                <WidgetSlot component={component} size={item.size} />
              </GridItem>,
            ]
          : [];
      })}
    </DashboardGrid>
  );
}

function PatientDetail({ patientId }: { patientId: string }) {
  const [today] = useState(todayInBrowserZone);
  const [range, setRange] = useState<DateRange>(() => toRange(DEFAULT_PRESET, today));
  const scope = useMemo(() => ({ patientId }), [patientId]);
  const name = usePatientName(patientId);
  return (
    <SummaryScopeProvider scope={scope}>
      <PeriodProvider range={range}>
        <div className={styles.page}>
          <Link to={PORTFOLIO_PATH} className={styles.back}>
            {BACK_LABEL}
          </Link>
          <h1 className={styles.title}>{name}</h1>
          <PeriodFilter value={range} today={today} onChange={setRange} />
          <LeaveWhenRevoked patientId={patientId} range={range} />
          <PatientCards />
        </div>
      </PeriodProvider>
    </SummaryScopeProvider>
  );
}

/** What an id that is not a patient's (not a UUID) gets: no request is made for it. */
function PatientNotFound() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{PATIENT_NOT_FOUND_TITLE}</h1>
      <Link to={PORTFOLIO_PATH} className={styles.back}>
        {BACK_LABEL}
      </Link>
    </div>
  );
}

/**
 * A linked patient's dashboard for the professional (PRO-08): the patient's own
 * widgets over the patient's summary, in the patient's default layout (it is not
 * customizable here), with the period filter and the way back to the portfolio.
 * The patient is the `:id` of the route, which must be a UUID.
 */
export function PatientDetailPage() {
  const { id } = useParams();
  return id !== undefined && UUID.test(id) ? <PatientDetail patientId={id} /> : <PatientNotFound />;
}
