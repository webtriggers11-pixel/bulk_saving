-- FEAT-043 (ADR-0050): a society's full address and an optional contact phone. Additive and
-- nullable: existing societies keep working and show "Address missing" to the admin.
ALTER TABLE "Society" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "Society" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Society" ADD COLUMN "landmark" TEXT;
ALTER TABLE "Society" ADD COLUMN "state" TEXT;
ALTER TABLE "Society" ADD COLUMN "pincode" TEXT;
ALTER TABLE "Society" ADD COLUMN "contactPhone" TEXT;
