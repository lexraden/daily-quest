import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { apiEnv } from '../env.api.js';
import { prisma } from '../db.js';
import { badRequest } from './errors.js';

// Only what the app actually uploads: meal photos and avatars.
const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/heic', 'heic'],
]);

/**
 * Identify the type from the bytes, not the client's Content-Type header. A
 * mislabelled upload would otherwise be stored and later served back with a
 * type the browser is willing to execute.
 */
function sniffMimeType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  const ascii = buf.subarray(0, 12).toString('latin1');
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (ascii.slice(4, 8) === 'ftyp') {
    const brand = ascii.slice(8, 12);
    if (brand === 'heic' || brand === 'heix' || brand === 'mif1') return 'image/heic';
  }
  return null;
}

/**
 * A browser cannot put an Authorization header on an <img> request, so image
 * URLs carry a signature instead of relying on the bearer token. The signature
 * covers the file id and its owner, is stable for the life of the file (URLs
 * are persisted inside meal_history), and is only ever minted by us.
 */
export function signFileId(fileId: string, userId: string): string {
  return createHmac('sha256', apiEnv.FILE_SIGNING_SECRET)
    .update(`${fileId}:${userId}`)
    .digest('base64url')
    .slice(0, 32);
}

export function verifyFileSignature(
  fileId: string,
  userId: string,
  signature: string,
): boolean {
  const expected = Buffer.from(signFileId(fileId, userId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const fileUrl = (fileId: string, userId: string) =>
  `/api/files/${fileId}?sig=${signFileId(fileId, userId)}`;

export async function storeUpload(
  userId: string,
  bytes: Buffer,
): Promise<{ id: string; url: string; mimeType: string; bytes: number }> {
  if (bytes.length === 0) throw badRequest('That file is empty');
  if (bytes.length > apiEnv.MAX_UPLOAD_BYTES) {
    throw badRequest(
      `Images must be under ${Math.floor(apiEnv.MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
    );
  }

  const mimeType = sniffMimeType(bytes);
  if (!mimeType || !ALLOWED.has(mimeType)) {
    throw badRequest('Upload a JPEG, PNG, WebP or HEIC image');
  }

  // Path is derived from the user id and a random name — never from anything
  // the client sends, so there is no traversal to defend against.
  const name = `${randomBytes(16).toString('hex')}.${ALLOWED.get(mimeType)}`;
  const relative = join(userId, name);
  const absolute = join(apiEnv.UPLOAD_DIR, relative);

  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);

  const record = await prisma.file.create({
    data: { userId, path: relative, mimeType, bytes: bytes.length },
  });

  return {
    id: record.id,
    url: fileUrl(record.id, userId),
    mimeType,
    bytes: bytes.length,
  };
}

export async function readFileForUser(
  fileId: string,
  userId: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  // Ownership is part of the lookup, so another user's id is simply not found.
  const record = await prisma.file.findFirst({ where: { id: fileId, userId } });
  if (!record) return null;
  return readRecord(record);
}

/** Signature path: the signature already proves who the file belongs to. */
export async function readSignedFile(
  fileId: string,
  signature: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const record = await prisma.file.findUnique({ where: { id: fileId } });
  if (!record) return null;
  if (!verifyFileSignature(fileId, record.userId, signature)) return null;
  return readRecord(record);
}

async function readRecord(record: {
  path: string;
  mimeType: string;
}): Promise<{ bytes: Buffer; mimeType: string } | null> {

  try {
    const bytes = await readFile(join(apiEnv.UPLOAD_DIR, record.path));
    return { bytes, mimeType: record.mimeType };
  } catch {
    return null;
  }
}

export async function deleteFileForUser(fileId: string, userId: string): Promise<boolean> {
  const record = await prisma.file.findFirst({ where: { id: fileId, userId } });
  if (!record) return false;

  await prisma.file.delete({ where: { id: record.id } });
  await unlink(join(apiEnv.UPLOAD_DIR, record.path)).catch(() => {});
  return true;
}

export const ensureUploadDir = () => mkdir(apiEnv.UPLOAD_DIR, { recursive: true });
