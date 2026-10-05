/// <reference types="node" />
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AppError, type AppErrorDetails, type AppErrorKind } from '../../../../shared/domain/appError';
import { cohortSummaryOf, patientPageOf, patientRowOf } from '../../../../test/professionalFakes';
import { renderProfessionalWidget, TEST_DAYS } from '../../../../test/professionalWidgetHarness';
import { describeCatalogDefinition } from '../../../../test/widgetHarness';
import { INVALID_INVITE_CODE } from '../../application/professionalUseCases';
import { useCohort } from '../useCohort';
import { usePatients } from '../usePatients';
import ProRedeemCode, { CODE_LABEL, PRO_REDEEM_CODE_TITLE, proRedeemCodeDefinition, SUBMIT_LABEL } from './proRedeemCode';

const css = readFileSync(join(import.meta.dirname, 'proRedeemCode.module.css'), 'utf8');

afterEach(() => vi.restoreAllMocks());

const field = () => screen.findByRole('textbox', { name: CODE_LABEL });
const submitButton = () => screen.getByRole('button', { name: SUBMIT_LABEL });

async function typeCode(text: string) {
  const user = userEvent.setup();
  await user.type(await field(), text);
  return user;
}

describeCatalogDefinition(proRedeemCodeDefinition, 'HEALTH_PROFESSIONAL');

describe('pro-redeem-code form (PRO-01)', () => {
  it('is always the form: a titled card with the code field and its submit, and no request for data', async () => {
    const { services } = renderProfessionalWidget(<ProRedeemCode size="M" />);

    const card = within(await screen.findByRole('region', { name: PRO_REDEEM_CODE_TITLE }));
    expect(card.getByRole('textbox', { name: CODE_LABEL })).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Vincular paciente' })).toBeEnabled();
    expect(screen.queryByRole('status', { name: 'Carregando' })).not.toBeInTheDocument();
    expect(services.loadPatients).not.toHaveBeenCalled();
    expect(services.loadCohort).not.toHaveBeenCalled();
  });

  it('writes the code in capitals as it is typed, in a monospace face', async () => {
    renderProfessionalWidget(<ProRedeemCode size="M" />);

    await typeCode('ab3x-9k 7q');

    expect(await field()).toHaveValue('AB3X-9K 7Q');
    expect(css).toMatch(/\.input\s*\{[^}]*font-family:\s*ui-monospace/);
  });

  it('is operable by keyboard: tab from the field to the submit, Enter sends the code', async () => {
    const { services } = renderProfessionalWidget(<ProRedeemCode size="M" />);
    const user = await typeCode('abc123');

    await user.tab();
    expect(submitButton()).toHaveFocus();

    await user.tab({ shift: true });
    await user.keyboard('{Enter}');

    expect(services.redeemInvite).toHaveBeenCalledWith('ABC123');
  });
});

describe('pro-redeem-code success (PRO-02)', () => {
  it('sends the code, clears the field and says "Paciente vinculado"', async () => {
    const { services } = renderProfessionalWidget(<ProRedeemCode size="M" />);
    const user = await typeCode('k7m2-9qpx');

    await user.click(submitButton());

    expect(await screen.findByRole('status')).toHaveTextContent('Paciente vinculado');
    expect(services.redeemInvite).toHaveBeenCalledTimes(1);
    expect(services.redeemInvite).toHaveBeenCalledWith('K7M2-9QPX');
    expect(await field()).toHaveValue('');
  });

  it('puts the new patient in the list and the cohort without a reload', async () => {
    const ana = patientRowOf();
    const bia = patientRowOf({ patientId: 'p2', displayName: 'Bia Lima', fullName: 'Bia Lima', initials: 'BL' });
    const loadPatients = vi.fn().mockResolvedValueOnce(patientPageOf([ana])).mockResolvedValue(patientPageOf([ana, bia]));
    const loadCohort = vi
      .fn()
      .mockResolvedValueOnce(cohortSummaryOf({ patientCount: 1 }))
      .mockResolvedValue(cohortSummaryOf({ patientCount: 2 }));
    function Portfolio() {
      const patients = usePatients(TEST_DAYS);
      const cohort = useCohort(TEST_DAYS);
      return (
        <>
          <p data-testid="count">{cohort.data?.patientCount}</p>
          <ul>
            {patients.data?.items.map((row) => (
              <li key={row.patientId}>{row.displayName}</li>
            ))}
          </ul>
        </>
      );
    }
    renderProfessionalWidget(
      <>
        <ProRedeemCode size="M" />
        <Portfolio />
      </>,
      { services: { loadPatients, loadCohort } },
    );
    await screen.findByText('Ana Souza');
    expect(screen.queryByText('Bia Lima')).not.toBeInTheDocument();
    const user = await typeCode('K7M29QPX');

    await user.click(submitButton());

    expect(await screen.findByText('Bia Lima')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
    expect([loadPatients.mock.calls.length, loadCohort.mock.calls.length]).toEqual([2, 2]);
  });

  it('disables the submit and says it is working while the call is open', async () => {
    const redeemInvite = vi.fn().mockReturnValue(new Promise(() => undefined));
    renderProfessionalWidget(<ProRedeemCode size="M" />, { services: { redeemInvite } });
    const user = await typeCode('ABC');

    await user.click(submitButton());

    expect(await screen.findByRole('button', { name: 'Vinculando…' })).toBeDisabled();
  });
});

type Failure = [description: string, kind: AppErrorKind, details: AppErrorDetails, message: string];

const FAILURES: Failure[] = [
  ['an unknown, expired or used code', 'validation', { code: INVALID_INVITE_CODE }, 'Código inválido ou expirado'],
  ['too many tries', 'rate-limited', {}, 'Muitas tentativas. Tente novamente em alguns minutos.'],
  ['too many tries with 60 s to wait', 'rate-limited', { retryAfterSeconds: 60 }, 'Muitas tentativas. Tente novamente em 1 minuto.'],
  ['too many tries with 61 s to wait', 'rate-limited', { retryAfterSeconds: 61 }, 'Muitas tentativas. Tente novamente em 2 minutos.'],
  ['too many tries with 900 s to wait', 'rate-limited', { retryAfterSeconds: 900 }, 'Muitas tentativas. Tente novamente em 15 minutos.'],
  ['an outage', 'unavailable', {}, 'Serviço indisponível. Tente novamente em instantes.'],
  ['an account that is not a professional', 'forbidden', { code: 'FORBIDDEN_ROLE' }, 'Não foi possível vincular o paciente. Tente novamente.'],
];

describe('pro-redeem-code failures (CON-05)', () => {
  it.each(FAILURES)('says the right thing for %s', async (_description, kind, details, message) => {
    const redeemInvite = vi.fn().mockRejectedValue(new AppError(kind, details));
    renderProfessionalWidget(<ProRedeemCode size="M" />, { services: { redeemInvite } });
    const user = await typeCode('WRONG1');

    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    // The code stays in the field so it can be fixed, and nothing says it worked.
    expect(await field()).toHaveValue('WRONG1');
    expect(screen.queryByText('Paciente vinculado')).not.toBeInTheDocument();
  });

  it('keeps a failure that is not an AppError inside the card too, with the general sentence', async () => {
    const redeemInvite = vi.fn().mockRejectedValue(new TypeError('boom'));
    renderProfessionalWidget(<ProRedeemCode size="M" />, { services: { redeemInvite } });
    const user = await typeCode('X');

    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível vincular o paciente. Tente novamente.');
    expect(screen.getByRole('region', { name: PRO_REDEEM_CODE_TITLE })).toBeInTheDocument();
  });

  it.each([
    ['an empty field', ''],
    ['a field with only blanks', '   '],
  ])('sends nothing and says so for %s', async (_description, text) => {
    const { services } = renderProfessionalWidget(<ProRedeemCode size="M" />);
    const user = userEvent.setup();
    if (text) await user.type(await field(), text);

    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o código que o paciente gerou no aplicativo');
    expect(services.redeemInvite).not.toHaveBeenCalled();
  });

  it('removes the message and marks the field valid again once the code is edited', async () => {
    const redeemInvite = vi.fn().mockRejectedValue(new AppError('validation', { code: INVALID_INVITE_CODE }));
    renderProfessionalWidget(<ProRedeemCode size="M" />, { services: { redeemInvite } });
    const user = await typeCode('BAD');
    await user.click(submitButton());
    expect(await field()).toBeInvalid();

    await user.type(await field(), '2');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await field()).toBeValid();
  });

  it('lets the next try succeed after a failure', async () => {
    const redeemInvite = vi.fn().mockRejectedValueOnce(new AppError('unavailable')).mockResolvedValue({ patientId: 'p9', grantId: 'g9' });
    renderProfessionalWidget(<ProRedeemCode size="M" />, { services: { redeemInvite } });
    const user = await typeCode('ABC');
    await user.click(submitButton());
    await screen.findByRole('alert');

    await user.click(submitButton());

    expect(await screen.findByText('Paciente vinculado')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('pro-redeem-code accessibility', () => {
  it('has no axe violations as a bare form, with an error and after a success', async () => {
    const redeemInvite = vi.fn().mockRejectedValueOnce(new AppError('unavailable')).mockResolvedValue({ patientId: 'p9', grantId: 'g9' });
    const { container } = renderProfessionalWidget(<ProRedeemCode size="M" />, { services: { redeemInvite } });
    expect(await axe(container)).toHaveNoViolations();

    const user = await typeCode('ABC');
    await user.click(submitButton());
    await screen.findByRole('alert');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(submitButton());
    await screen.findByText('Paciente vinculado');
    expect(await axe(container)).toHaveNoViolations();
  });
});
