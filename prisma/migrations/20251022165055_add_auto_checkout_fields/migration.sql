-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "approvedOvertimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "autoCheckedOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoCheckoutReason" TEXT,
ADD COLUMN     "maxAllowedHours" DOUBLE PRECISION;
