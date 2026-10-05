import { vi } from 'vitest';

/** Makes the browser resolve `timeZone`; undo with `vi.restoreAllMocks()`. */
export const withTimeZone = (timeZone: string) =>
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone } as Intl.ResolvedDateTimeFormatOptions);
