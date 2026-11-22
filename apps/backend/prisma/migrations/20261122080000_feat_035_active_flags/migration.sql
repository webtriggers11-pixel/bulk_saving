-- FEAT-035 (ADR-0045): deactivate, don't delete. Additive: every existing row stays active.
ALTER TABLE "Resident" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Society" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
