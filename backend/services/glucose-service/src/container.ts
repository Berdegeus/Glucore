import { recordAudit as recordAuditWith, type AuditEntry } from '@glucore/shared';
import type { PrismaClient } from '@prisma/client';

import { prisma as defaultPrisma } from './lib/prisma';
import { AlertsController } from './modules/alerts/alerts.controller';
import { PrismaAlertRepository } from './modules/alerts/alerts.repository';
import { AlertsService } from './modules/alerts/alerts.service';
import { CarbsController } from './modules/carbs/carbs.controller';
import { PrismaCarbRepository } from './modules/carbs/carbs.repository';
import { CarbsService } from './modules/carbs/carbs.service';
import { InsulinController } from './modules/insulin/insulin.controller';
import { PrismaInsulinRepository } from './modules/insulin/insulin.repository';
import { InsulinService } from './modules/insulin/insulin.service';
import { PrismaPatientRepository } from './modules/patient/patient.repository';
import { ReadingsController } from './modules/readings/readings.controller';
import { PrismaReadingRepository } from './modules/readings/readings.repository';
import { SettingsController } from './modules/settings/settings.controller';
import { PrismaSettingsRepository } from './modules/settings/settings.repository';
import { SettingsService } from './modules/settings/settings.service';
import { ReadingsService } from './modules/readings/readings.service';

/**
 * Everything `buildApp` needs to mount a router.
 *
 * Controllers rather than services, because the router is the only consumer;
 * the services hang off them by construction.
 */
export interface Container {
  readings: ReadingsController;
  carbs: CarbsController;
  insulin: InsulinController;
  alerts: AlertsController;
  settings: SettingsController;
}

/**
 * Composition root: the one place that knows which implementation satisfies
 * which interface.
 *
 * Wired by hand instead of through a container library. At this size the
 * wiring is a few lines per module and stays fully typed, where decorators
 * would cost a metadata build step and hide the dependency graph the whole
 * refactor exists to make visible.
 */
export function createContainer(prisma: PrismaClient = defaultPrisma): Container {
  const recordAudit = (entry: AuditEntry): Promise<void> => recordAuditWith(entry, prisma);

  const patients = new PrismaPatientRepository(prisma);

  return {
    readings: new ReadingsController(
      new ReadingsService(new PrismaReadingRepository(prisma), patients, recordAudit),
    ),
    carbs: new CarbsController(
      new CarbsService(new PrismaCarbRepository(prisma), patients, recordAudit),
    ),
    insulin: new InsulinController(
      new InsulinService(new PrismaInsulinRepository(prisma), patients, recordAudit),
    ),
    alerts: new AlertsController(
      new AlertsService(new PrismaAlertRepository(prisma), patients, recordAudit),
    ),
    settings: new SettingsController(
      new SettingsService(new PrismaSettingsRepository(prisma), patients, recordAudit),
    ),
  };
}
