/*
  Warnings:

  - You are about to drop the column `category` on the `Reimbursement` table. All the data in the column will be lost.
  - Added the required column `reimbursementTypeId` to the `Reimbursement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Payroll" ALTER COLUMN "totalSalary" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Reimbursement" DROP COLUMN "category",
ADD COLUMN     "reimbursementTypeId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ReimbursementType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementType_name_key" ON "ReimbursementType"("name");

-- CreateIndex
CREATE INDEX "ReimbursementType_isActive_idx" ON "ReimbursementType"("isActive");

-- CreateIndex
CREATE INDEX "Reimbursement_reimbursementTypeId_idx" ON "Reimbursement"("reimbursementTypeId");

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_reimbursementTypeId_fkey" FOREIGN KEY ("reimbursementTypeId") REFERENCES "ReimbursementType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
