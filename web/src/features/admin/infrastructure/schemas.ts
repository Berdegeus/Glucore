import * as z from 'zod';
import { ROLES } from '../../../shared/domain/role';

// Every field the web reads is required (ARQ-07). Unknown extra fields are
// stripped, so nothing the gateway might add about a person leaks inward
// (ADM-03).

const count = z.number().int().nonnegative();

const RoleSchema = z.enum(ROLES);
const StatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']);
const DayCountSchema = z.object({ day: z.string().min(1), count });

/** `GET /admin/overview` (ADM-01, ADM-02). */
export const AdminOverviewDtoSchema = z.object({
  accounts: z.object({
    total: count,
    byRole: z.array(z.object({ role: RoleSchema, count })),
    byStatus: z.array(z.object({ status: StatusSchema, count })),
  }),
  registrationsInPeriod: count,
  registrationsByDay: z.array(DayCountSchema),
  activePatients: z.object({ last24h: count, last7d: count, registered: count }),
  readingsByDay: z.array(DayCountSchema),
  grants: z.object({
    active: count,
    createdByWeek: z.array(z.object({ weekStart: z.string().min(1), count })),
  }),
  alertsByType: z.array(z.object({ alertType: z.string().min(1), count })),
});

/** `GET /admin/users` (ADM-04). */
export const AccountPageDtoSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      fullName: z.string(),
      email: z.string(),
      role: RoleSchema,
      status: StatusSchema,
      createdAt: z.string().min(1),
    }),
  ),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
});

export type AdminOverviewDto = z.infer<typeof AdminOverviewDtoSchema>;
export type AccountPageDto = z.infer<typeof AccountPageDtoSchema>;
