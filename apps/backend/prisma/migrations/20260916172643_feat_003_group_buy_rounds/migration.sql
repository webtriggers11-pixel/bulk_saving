-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'OPEN',
    "unitsCount" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundTier" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "RoundTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundParticipant" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoundParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Round_societyId_status_idx" ON "Round"("societyId", "status");

-- CreateIndex
CREATE INDEX "RoundTier_roundId_idx" ON "RoundTier"("roundId");

-- CreateIndex
CREATE INDEX "RoundParticipant_residentId_idx" ON "RoundParticipant"("residentId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundParticipant_roundId_residentId_key" ON "RoundParticipant"("roundId", "residentId");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundTier" ADD CONSTRAINT "RoundTier_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundParticipant" ADD CONSTRAINT "RoundParticipant_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundParticipant" ADD CONSTRAINT "RoundParticipant_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index (ADR-0010): at most ONE OPEN round per (societyId, serviceId).
-- Prisma has no declarative partial-unique index, so it is created via raw SQL here.
-- A second OPEN round for the same (society, service) violates this and is rejected
-- (the rounds service catches it and returns 409 ROUND_ALREADY_OPEN, never a 500).
CREATE UNIQUE INDEX "Round_one_open_per_society_service"
    ON "Round"("societyId", "serviceId")
    WHERE "status" = 'OPEN';
