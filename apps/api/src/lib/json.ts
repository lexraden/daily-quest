import type { Prisma } from '@prisma/client';

/**
 * Prisma's InputJsonValue does not accept `unknown`-valued records, which is
 * what Zod produces for the free-form JSON columns. The values are already
 * validated as JSON-shaped by the time they get here.
 */
export const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;
