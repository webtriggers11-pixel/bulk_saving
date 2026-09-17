-- FEAT-004 (ADR-0011): extend the RoundStatus enum from the interim OPEN|CLOSED
-- to the full lifecycle. Existing 'CLOSED' rows are mapped to 'CLOSED_EXPIRED'
-- (the neutral closed state) so the type change never fails on live dev data.
--
-- The partial unique index (WHERE status = 'OPEN') is dropped before the enum
-- swap and recreated after: its predicate compares the column against the old
-- enum type, which would otherwise block ALTER COLUMN ... TYPE. 'OPEN' is
-- preserved, so the recreated index is semantically identical.

-- AlterEnum
BEGIN;
DROP INDEX "Round_one_open_per_society_service";
CREATE TYPE "RoundStatus_new" AS ENUM ('OPEN', 'CLOSED_MET', 'CLOSED_EXPIRED', 'ASSIGNED', 'DELIVERED', 'RATED', 'CANCELLED');
ALTER TABLE "Round" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Round" ALTER COLUMN "status" TYPE "RoundStatus_new" USING (
  (CASE "status"::text WHEN 'CLOSED' THEN 'CLOSED_EXPIRED' ELSE "status"::text END)::"RoundStatus_new"
);
ALTER TYPE "RoundStatus" RENAME TO "RoundStatus_old";
ALTER TYPE "RoundStatus_new" RENAME TO "RoundStatus";
DROP TYPE "RoundStatus_old";
ALTER TABLE "Round" ALTER COLUMN "status" SET DEFAULT 'OPEN';
CREATE UNIQUE INDEX "Round_one_open_per_society_service"
    ON "Round"("societyId", "serviceId")
    WHERE "status" = 'OPEN';
COMMIT;
