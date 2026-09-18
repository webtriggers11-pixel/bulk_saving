-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "unitDescription" TEXT,
ADD COLUMN     "unitLabel" TEXT NOT NULL DEFAULT 'unit',
ADD COLUMN     "unitLabelPlural" TEXT NOT NULL DEFAULT 'units';

