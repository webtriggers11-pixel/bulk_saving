-- FEAT-005 (ADR-0012): global Vendor table; assignment + delivery columns on Round
-- (vendorId FK with ON DELETE RESTRICT, finalPrice, assignedAt, deliveredAt) plus a
-- status index for the admin list/dashboard; per-participant paymentCollectedAt.
-- Purely additive (nullable columns + new table), so it applies cleanly to existing rows.

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "finalPrice" INTEGER,
ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "RoundParticipant" ADD COLUMN     "paymentCollectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Round_status_idx" ON "Round"("status");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

