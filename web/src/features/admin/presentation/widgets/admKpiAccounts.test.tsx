import { overviewOf, zeroOverviewOf } from '../../../../test/adminFakes';
import { describeAdminFigure, describeAdminWidget } from '../../../../test/adminWidgetHarness';
import AdmKpiAccounts, { ADM_KPI_ACCOUNTS_TITLE, admKpiAccountsDefinition } from './admKpiAccounts';

describeAdminWidget({ Widget: AdmKpiAccounts, definition: admKpiAccountsDefinition, title: ADM_KPI_ACCOUNTS_TITLE, shown: '42' });

describeAdminFigure({
  Widget: AdmKpiAccounts,
  title: 'Contas',
  requirement: 'ADM-01',
  samples: [
    { name: 'shows the total with the split by status', overview: overviewOf(), shown: ['42', 'Ativas 38 · Inativas 3 · Bloqueadas 1'] },
    {
      name: 'lists the statuses in a fixed order and counts one the API left out as zero',
      overview: overviewOf({
        accounts: {
          total: 1250,
          byRole: [],
          byStatus: [
            { status: 'BLOCKED', count: 50 },
            { status: 'ACTIVE', count: 1200 },
          ],
        },
      }),
      shown: ['1250', 'Ativas 1200 · Inativas 0 · Bloqueadas 50'],
    },
    { name: 'shows 0, not an empty state, when there is no account', overview: zeroOverviewOf(), shown: ['0', 'Ativas 0 · Inativas 0 · Bloqueadas 0'] },
  ],
});
