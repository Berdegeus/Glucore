import nodemailer, { type Transporter } from 'nodemailer';

import { EMAIL_BANNER_PNG_BASE64 } from './emailAssets';
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

/** Where the e-mail sends the person: the web page that takes the token from the query string. */
export function resetUrl(webAppUrl: string | null, token: string): string | null {
  return webAppUrl ? `${webAppUrl}/redefinir-senha?token=${encodeURIComponent(token)}` : null;
}

export function resetText(token: string, url: string | null): string {
  const link = url ? `Para redefinir pelo navegador, abra o link:\n${url}\n\n` : '';
  return (
    `Você pediu para redefinir a senha do Glucore.\n\n${link}` +
    `Ou, no aplicativo, use o código abaixo:\n\n${token}\n\n` +
    `Este código expira em 6 horas. Se você não fez o pedido, ignore esta mensagem.`
  );
}

/** The banner travels inside the message (attached by CID), so it shows without any image hosting. */
export const BANNER_CID = 'glucore-banner';

const BRAND = '#0052ff';

export function resetHtml(token: string, url: string | null): string {
  const button = url
    ? `<tr><td align="center" style="padding:8px 32px 8px">
        <a href="${url}" style="display:inline-block;padding:14px 34px;background:${BRAND};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px">Redefinir minha senha</a>
      </td></tr>
      <tr><td align="center" style="padding:12px 32px 4px;font-size:13px;line-height:19px;color:#64748b">
        Se o botão não abrir, copie este endereço no navegador:<br>
        <a href="${url}" style="color:${BRAND};word-break:break-all">${url}</a>
      </td></tr>`
    : '';
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Glucore — Recuperação de senha</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Redefina a senha da sua conta Glucore. O link vale por 6 horas.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td><img src="cid:${BANNER_CID}" width="600" alt="Glucore" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:${BRAND}"></td></tr>
    <tr><td style="padding:30px 32px 6px;font-size:24px;line-height:30px;font-weight:800">Redefinir sua senha</td></tr>
    <tr><td style="padding:0 32px 18px;font-size:16px;line-height:24px;color:#334155">
      Recebemos um pedido para redefinir a senha da sua conta no Glucore. Toque no botão abaixo para escolher uma nova senha.
    </td></tr>
    ${button}
    <tr><td style="padding:22px 32px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:10px"><tr><td align="center" style="padding:16px">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#64748b;padding-bottom:6px">Usando o aplicativo? Digite este código</div>
      <div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:17px;font-weight:700;color:#0f172a;word-break:break-all">${token}</div>
    </td></tr></table></td></tr>
    <tr><td style="padding:18px 32px 30px;font-size:13px;line-height:19px;color:#64748b">
      O link e o código expiram em <strong>6 horas</strong> e só podem ser usados uma vez. Se você não pediu a redefinição, ignore esta mensagem: sua senha continua a mesma.
    </td></tr>
    <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:18px;color:#94a3b8;text-align:center">
      Glucore — monitoramento contínuo de glicose<br>Esta é uma mensagem automática, não responda a este e-mail.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;

  constructor(
    private readonly config: SmtpConfig,
    private readonly webAppUrl: string | null = null,
  ) {
    const { host, port, user, pass } = config;
    // 465 is implicit TLS; anything else (587) must upgrade with STARTTLS, never fall back to plain text.
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
    });
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const url = resetUrl(this.webAppUrl, token);
    await this.transporter.sendMail({
      from: `"Glucore" <${this.config.from}>`,
      to: email,
      subject: 'Glucore — Recuperação de senha',
      text: resetText(token, url),
      html: resetHtml(token, url),
      attachments: [
        {
          filename: 'glucore.png',
          content: Buffer.from(EMAIL_BANNER_PNG_BASE64, 'base64'),
          contentType: 'image/png',
          cid: BANNER_CID,
          contentDisposition: 'inline',
        },
      ],
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
  constructor(private readonly webAppUrl: string | null = null) {}

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const url = resetUrl(this.webAppUrl, token);
    console.log(`[auth] no SMTP configured — reset token for ${email}: ${token}${url ? ` (${url})` : ''}`);
  }
}

/** Picks the mailer from configuration. The one place that decides. */
export function createMailer(smtp: SmtpConfig | null, webAppUrl: string | null = null): Mailer {
  return smtp ? new SmtpMailer(smtp, webAppUrl) : new ConsoleMailer(webAppUrl);
}
