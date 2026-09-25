/**
 * Email through Resend, for the API's test send.
 *
 * The reminders job still builds its own client — it predates this file and
 * its sending loop is not what changed — but the two agree on the one thing
 * that matters: Resend reports API failures in the result rather than by
 * throwing, so the result is what gets checked. A rejected key, an unverified
 * sender domain and a network failure all come back as `{ error }` from
 * `emails.send`, and a caller that only wrapped it in try/catch would report
 * every one of them as delivered.
 *
 * Optional, like the other channels: no key and `emailEnabled()` is false, the
 * profile says so, and nothing is attempted.
 */

import { Resend } from 'resend';

export interface EmailConfig {
  apiKey: string;
  /** "Name <address>". Its domain must be verified in Resend or every send is refused. */
  from: string;
}

let configured: EmailConfig | null = null;

export function configureEmail(config: EmailConfig | null): void {
  configured = config && config.apiKey ? config : null;
}

export const emailEnabled = (): boolean => configured !== null;

export interface Email {
  to: string;
  subject: string;
  html: string;
}

/** Resend's own account of a refusal: its error name, and its words. */
export interface EmailError {
  name: string;
  message: string;
}

export type EmailResult = { ok: true; id: string | null } | { ok: false; error: EmailError };

/**
 * How an email actually leaves the process.
 *
 * Injectable for the same reason push's and Telegram's are: what is worth
 * testing is that a refusal is read as a refusal, not that the SDK can speak
 * HTTP. Over the wire the tests go one level lower instead — the SDK reads
 * RESEND_BASE_URL from the environment when it is first imported, so a server
 * started with it pointed at a stub sends there, with no seam of ours involved.
 */
export type Sender = (config: EmailConfig, email: Email) => Promise<EmailResult>;

const liveSender: Sender = async (config, email) => {
  const { data, error } = await new Resend(config.apiKey).emails.send({
    from: config.from,
    to: email.to,
    subject: email.subject,
    html: email.html,
  });
  if (error) return { ok: false, error: { name: String(error.name), message: error.message } };
  return { ok: true, id: data?.id ?? null };
};

let sender: Sender = liveSender;

/** Swaps the transport. Pass nothing to put the real one back. */
export function setSender(next: Sender | null): void {
  sender = next ?? liveSender;
}

/**
 * Why an email did not go, in the terms someone fixing it needs.
 *
 * Resend's error names are not a stable enough contract to show as they are —
 * an invalid key has been both `invalid_api_key` and a `validation_error`
 * saying "API key is invalid" — so the message is read as well. Anything not
 * recognised is `rejected`, with Resend's own message alongside.
 */
export type EmailProblem =
  | 'bad_key'
  | 'sender_unverified'
  | 'rate_limited'
  | 'unreachable'
  | 'rejected';

export function classify(error: EmailError): EmailProblem {
  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();

  if (/api_key/.test(name) || /api key/.test(message)) return 'bad_key';
  /**
   * An unverified domain, and the testing-mode restriction that applies until
   * one is verified ("you can only send testing emails to your own address"),
   * are the same fix: verify the domain REMINDER_FROM uses.
   */
  if (
    name === 'invalid_from_address' ||
    /not verified|verify a domain|testing emails/.test(message)
  ) {
    return 'sender_unverified';
  }
  if (name === 'rate_limit_exceeded' || /quota/.test(name + message)) return 'rate_limited';
  // What the SDK returns for a network failure or a response it could not parse.
  if (name === 'application_error' || name === 'internal_server_error') return 'unreachable';
  return 'rejected';
}

export type SendOutcome =
  | { sent: true; id: string | null }
  | { sent: false; reason: 'disabled' }
  | { sent: false; reason: EmailProblem; detail: string };

export async function sendEmail(email: Email): Promise<SendOutcome> {
  if (!configured) return { sent: false, reason: 'disabled' };

  let result: EmailResult;
  try {
    result = await sender(configured, email);
  } catch (err) {
    // The SDK does not throw for API failures, but a transport can; either way
    // nothing was sent, and saying so is the whole job here.
    result = {
      ok: false,
      error: { name: 'application_error', message: String((err as Error)?.message ?? err) },
    };
  }

  if (result.ok) return { sent: true, id: result.id };

  console.error('email send failed:', result.error.name, result.error.message);
  return { sent: false, reason: classify(result.error), detail: result.error.message };
}
