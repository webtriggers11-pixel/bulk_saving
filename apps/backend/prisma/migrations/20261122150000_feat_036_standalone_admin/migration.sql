-- FEAT-036 (ADR-0046): a platform admin belongs to no society.
-- Relaxing only: existing rows keep their society. Roll back with SET NOT NULL once no NULL rows exist.
ALTER TABLE "Resident" ALTER COLUMN "societyId" DROP NOT NULL;

-- Only a SUPER_ADMIN may be society-less.
ALTER TABLE "Resident" ADD CONSTRAINT "Resident_society_or_admin_check"
  CHECK ("societyId" IS NOT NULL OR "role" = 'SUPER_ADMIN');

-- The composite (societyId, phone) unique does not constrain NULLs; one society-less row per phone.
CREATE UNIQUE INDEX "Resident_phone_standalone_key" ON "Resident"("phone") WHERE "societyId" IS NULL;
