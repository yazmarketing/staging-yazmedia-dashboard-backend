-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeductionType" AS ENUM ('ABSENCE', 'LOAN', 'ADVANCE', 'DISCIPLINARY', 'OTHER');

-- CreateEnum
CREATE TYPE "DeductionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalaryChangeType" AS ENUM ('PROMOTION', 'INCREMENT', 'PERFORMANCE', 'PROBATION_COMPLETION', 'CONTRACT_RENEWAL', 'INDUSTRY_STANDARD');

-- CreateEnum
CREATE TYPE "SalaryChangeStatus" AS ENUM ('PENDING', 'APPROVED_BY_HR', 'APPROVED_BY_MANAGEMENT', 'APPROVED_BY_FINANCE', 'REJECTED');

-- CreateTable
CREATE TABLE "Overtime" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hoursWorked" DOUBLE PRECISION NOT NULL,
    "overtimeHours" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Overtime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deduction" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "DeductionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "DeductionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryChange" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oldSalary" DOUBLE PRECISION NOT NULL,
    "newSalary" DOUBLE PRECISION NOT NULL,
    "changeType" "SalaryChangeType" NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "SalaryChangeStatus" NOT NULL DEFAULT 'PENDING',
    "approvedByHR" TEXT,
    "approvedByHRDate" TIMESTAMP(3),
    "approvedByMgmt" TEXT,
    "approvedByMgmtDate" TIMESTAMP(3),
    "approvedByFin" TEXT,
    "approvedByFinDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "rejectedBy" TEXT,
    "rejectedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Overtime_employeeId_idx" ON "Overtime"("employeeId");

-- CreateIndex
CREATE INDEX "Overtime_status_idx" ON "Overtime"("status");

-- CreateIndex
CREATE INDEX "Overtime_date_idx" ON "Overtime"("date");

-- CreateIndex
CREATE INDEX "Deduction_employeeId_idx" ON "Deduction"("employeeId");

-- CreateIndex
CREATE INDEX "Deduction_type_idx" ON "Deduction"("type");

-- CreateIndex
CREATE INDEX "Deduction_status_idx" ON "Deduction"("status");

-- CreateIndex
CREATE INDEX "SalaryChange_employeeId_idx" ON "SalaryChange"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryChange_status_idx" ON "SalaryChange"("status");

-- CreateIndex
CREATE INDEX "SalaryChange_effectiveDate_idx" ON "SalaryChange"("effectiveDate");

-- AddForeignKey
ALTER TABLE "Overtime" ADD CONSTRAINT "Overtime_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryChange" ADD CONSTRAINT "SalaryChange_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
