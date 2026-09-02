/**
 * Errors that are safe to show a client. Anything else becomes a generic 500 —
 * the handler in index.ts never serialises a stack trace into a response.
 */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (m: string, code?: string) => new HttpError(400, m, code);
export const unauthorized = (m = 'Not signed in') => new HttpError(401, m, 'unauthorized');
export const forbidden = (m: string, code?: string) => new HttpError(403, m, code);
export const notFound = (m = 'Not found') => new HttpError(404, m, 'not_found');
export const payloadTooLarge = (m: string) => new HttpError(413, m, 'too_large');
