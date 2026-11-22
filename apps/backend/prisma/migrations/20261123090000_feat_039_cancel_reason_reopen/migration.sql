-- FEAT-039 (ADR-0048): a reason on cancel, reopening, and the reopened message. Additive only.
ALTER TYPE "NotificationType" ADD VALUE 'ROUND_REOPENED';

ALTER TABLE "Round" ADD COLUMN "cancelReason" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "reopenCount" INTEGER NOT NULL DEFAULT 0;
