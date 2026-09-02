import type { FastifyInstance } from 'fastify';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import { badRequest, notFound, payloadTooLarge } from '../lib/errors.js';
import {
  storeUpload,
  readFileForUser,
  readSignedFile,
  deleteFileForUser,
} from '../lib/storage.js';
import { apiEnv } from '../env.api.js';

const tooLarge = () =>
  payloadTooLarge(`Images must be under ${Math.floor(apiEnv.MAX_UPLOAD_BYTES / 1024 / 1024)} MB`);

export default async function fileRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.isMultipart()) throw badRequest('Send the image as multipart form data');

    const part = await request.file({ limits: { fileSize: apiEnv.MAX_UPLOAD_BYTES } });
    if (!part) throw badRequest('No file was attached');

    let bytes: Buffer;
    try {
      bytes = await part.toBuffer();
    } catch {
      throw tooLarge();
    }
    // @fastify/multipart flags a truncated stream rather than throwing.
    if (part.file.truncated) throw tooLarge();

    const stored = await storeUpload(currentUserId(request), bytes);
    // `file_url` keeps the shape Base44's UploadFile returned, so the callers
    // that destructure it did not have to change.
    return reply.code(201).send({ ...stored, file_url: stored.url });
  });

  /**
   * Deliberately not behind requireAuth: an <img> tag cannot send a bearer
   * header. A valid `sig` proves the URL was minted by us for this file's
   * owner; a bearer token is still accepted for callers that have one.
   */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { sig } = request.query as { sig?: string };

    let file = null;
    if (sig) {
      file = await readSignedFile(id, sig);
    } else {
      await requireAuth(request);
      file = await readFileForUser(id, currentUserId(request));
    }
    if (!file) throw notFound('That file is no longer available');

    // Ids are random and content never changes under one, so this is safe to
    // cache hard — but privately, since the URL is per-user.
    return reply
      .header('Content-Type', file.mimeType)
      .header('Cache-Control', 'private, max-age=31536000, immutable')
      .header('X-Content-Type-Options', 'nosniff')
      // A stored image must never be interpreted as a document.
      .header('Content-Security-Policy', "default-src 'none'; sandbox")
      .send(file.bytes);
  });

  app.delete('/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const removed = await deleteFileForUser(id, currentUserId(request));
    if (!removed) throw notFound('That file is no longer available');
    return { ok: true };
  });
}
