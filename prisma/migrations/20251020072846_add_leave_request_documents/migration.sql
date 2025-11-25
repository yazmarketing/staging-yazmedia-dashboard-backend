-- CreateTable
CREATE TABLE "LeaveRequestDocument" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequestDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveRequestDocument_leaveRequestId_idx" ON "LeaveRequestDocument"("leaveRequestId");

-- AddForeignKey
ALTER TABLE "LeaveRequestDocument" ADD CONSTRAINT "LeaveRequestDocument_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
