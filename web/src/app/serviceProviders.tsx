import type { ReactNode } from 'react';
import type { Container } from '../composition/container';
import { LayoutServicesProvider } from '../features/dashboard-layout';
import { DiaryServicesProvider, SummaryServicesProvider } from '../features/patient-dashboard';
import { RegistrationServicesProvider } from '../features/registration';

/** Hands the container's use cases to the hooks and widgets below, so the presentation layer never builds one (ARQ-03). */
export function ServiceProviders({ container, children }: { container: Container; children: ReactNode }) {
  const { layout, summary, patientDiary, registration } = container.useCases;
  return (
    <LayoutServicesProvider services={layout}>
      <SummaryServicesProvider services={summary}>
        <DiaryServicesProvider services={patientDiary}>
          <RegistrationServicesProvider services={registration}>{children}</RegistrationServicesProvider>
        </DiaryServicesProvider>
      </SummaryServicesProvider>
    </LayoutServicesProvider>
  );
}
