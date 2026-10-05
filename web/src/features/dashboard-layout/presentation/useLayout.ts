import { useQuery } from '@tanstack/react-query';
import type { Role } from '../../../shared/domain/role';
import type { DashboardLayout } from '../domain/layout';
import { useLayoutServices } from './layoutServices';

/** Cache key of a role's layout, for the editor to write the saved layout into. */
export const layoutQueryKey = (role: Role) => ['layout', role] as const;

export interface UseLayoutResult {
  /** The layout to render, cleaned against the catalog; `null` until the first load ends. */
  layout: DashboardLayout | null;
  isLoading: boolean;
  /** True when the saved layout could not be read and the default stands in for it. */
  degraded: boolean;
}

/**
 * The layout of the signed-in role (LAY-02, LAY-08, LAY-10). It is not
 * dashboard data: the 5 minute reload and the reload on window focus are off,
 * so the grid never reshuffles under the person's hands. The layout loads once
 * and changes when the editor saves. A degraded result counts as stale, so the
 * next mount asks again instead of keeping the fallback.
 */
export function useLayout(role: Role): UseLayoutResult {
  const { loadLayout } = useLayoutServices();
  const query = useQuery({
    queryKey: layoutQueryKey(role),
    queryFn: () => loadLayout(role),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: (current) => (current.state.data?.degraded ? 0 : Infinity),
  });
  return {
    layout: query.data?.layout ?? null,
    isLoading: query.isPending,
    degraded: query.data?.degraded ?? false,
  };
}
