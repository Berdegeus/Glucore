// Port of the layout feature (ARQ-05). The use cases depend on it; the
// `infrastructure` folder implements it over HTTP.

import type { DashboardLayout } from './layout';

/** The signed-in person's saved layout, kept on the server (LAY-08). */
export interface LayoutRepository {
  /** The saved layout, or `null` when the person never saved one (LAY-02). */
  load(): Promise<DashboardLayout | null>;
  /** Stores the layout and returns what the server kept (LAY-07). A rejected layout fails with `validation`. */
  save(layout: DashboardLayout): Promise<DashboardLayout>;
  /** Deletes the saved layout (LAY-09). */
  reset(): Promise<void>;
}
