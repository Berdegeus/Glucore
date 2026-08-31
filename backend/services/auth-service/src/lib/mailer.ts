import nodemailer from 'nodemailer';

import type { SmtpConfig } from './env';

/**
 * Delivery of the password-reset token.
 *
 * The version this replaces wrapped the send in `try { ... } catch { log the
 * token }`. In development that reads as a convenience — no SMTP configured, so
 * print the code instead. In production it is a hole: a real delivery failure,
 * a wrong password, an unreachable relay, all look exactly like "not
 * configured", and the response to the user is a cheerful 200 either way.
 *
 * So the choice moves to configuration. No SMTP host means ConsoleMailer, by
 * intent, decided once at startup. With a host configured, SmtpMailer lets a
 * failure be a failure.
 */
export interface Mailer {
  sendPasswordReset(email: string, token: string): Promise<void>;
}

function resetMessage(token: string): string {
  return `Use o codigo abaixo para redefinir sua senha:\n\n${token}\n\nEste codigo expira em 6 horas.`;
}

export class SmtpMailer implements Mailer {
  constructor(private readonly config: SmtpConfig) {}

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const { host, port, user, pass } = this.config;
    const transporter = nodemailer.createTransport({ host, port, auth: { user, pass } });
    await transporter.sendMail({
      from: user,
      to: email,
      subject: 'Glucore - Recuperacao de senha',
      text: resetMessage(token),
    });
  }
}

/**
 * Prints the token to the log instead of sending it. For local development and
 * for tests, where no relay exists and the token has to be readable somewhere.
 *
 * Never select this in production: the reset token is a credential, and this
 * class puts it in the log on purpose.
 */
export class ConsoleMailer implements Mailer {
  async sendPasswordReset(email: string, token: string): Promise<void> {
    console.log(`[auth] no SMTP configured — reset token for ${email}: ${token}`);
  }
}

/** Picks the mailer from configuration. The one place that decides. */
export function createMailer(smtp: SmtpConfig | null): Mailer {
  return smtp ? new SmtpMailer(smtp) : new ConsoleMailer();
}
