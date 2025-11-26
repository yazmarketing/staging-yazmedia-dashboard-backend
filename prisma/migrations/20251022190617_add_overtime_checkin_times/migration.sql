/*
  Warnings:

  - You are about to drop the column `approvedOvertimeHours` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `autoCheckedOut` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `autoCheckoutReason` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `maxAllowedHours` on the `Attendance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "approvedOvertimeHours",
DROP COLUMN "autoCheckedOut",
DROP COLUMN "autoCheckoutReason",
DROP COLUMN "maxAllowedHours",
ADD COLUMN     "overtimeCheckInTime" TIMESTAMP(3),
ADD COLUMN     "overtimeCheckOutTime" TIMESTAMP(3);
