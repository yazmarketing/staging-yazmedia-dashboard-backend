-- CreateEnum
CREATE TYPE "OvertimeApprovalAction" AS ENUM ('APPROVED', 'REJECTED', 'RECALLED', 'MODIFIED');

-- CreateTable
CREATE TABLE "OvertimeApproval" (
    "id" TEXT NOT NULL,
    "overtimeRequestId" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "action" "OvertimeApprovalAction" NOT NULL,
    "approvalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comments" TEXT,
    "previousStatus" "OvertimeStatus",
    "previousHours" DOUBLE PRECISION,
    "newHours" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OvertimeApproval_overtimeRequestId_idx" ON "OvertimeApproval"("overtimeRequestId");

-- CreateIndex
CREATE INDEX "OvertimeApproval_approvedBy_idx" ON "OvertimeApproval"("approvedBy");

-- CreateIndex
CREATE INDEX "OvertimeApproval_action_idx" ON "OvertimeApproval"("action");

-- CreateIndex
CREATE INDEX "OvertimeApproval_approvalDate_idx" ON "OvertimeApproval"("approvalDate");

-- AddForeignKey
ALTER TABLE "OvertimeApproval" ADD CONSTRAINT "OvertimeApproval_overtimeRequestId_fkey" FOREIGN KEY ("overtimeRequestId") REFERENCES "OvertimeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeApproval" ADD CONSTRAINT "OvertimeApproval_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
