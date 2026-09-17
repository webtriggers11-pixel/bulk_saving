-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rating_roundId_idx" ON "Rating"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_roundId_residentId_key" ON "Rating"("roundId", "residentId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

