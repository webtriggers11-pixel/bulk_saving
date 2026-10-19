-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SERVICE_ASK_OPENED';

-- CreateTable
CREATE TABLE "ServiceAsk" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAsk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceAsk_societyId_serviceId_idx" ON "ServiceAsk"("societyId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAsk_residentId_serviceId_key" ON "ServiceAsk"("residentId", "serviceId");

-- AddForeignKey
ALTER TABLE "ServiceAsk" ADD CONSTRAINT "ServiceAsk_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAsk" ADD CONSTRAINT "ServiceAsk_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
