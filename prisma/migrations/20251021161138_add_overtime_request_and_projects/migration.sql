-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "canDoNextDay" BOOLEAN NOT NULL DEFAULT false,
    "urgencyReason" TEXT,
    "requestedHours" DOUBLE PRECISION NOT NULL,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Client_isActive_idx" ON "Client"("isActive");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_isActive_idx" ON "Project"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Project_name_clientId_key" ON "Project"("name", "clientId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_employeeId_idx" ON "OvertimeRequest"("employeeId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_status_idx" ON "OvertimeRequest"("status");

-- CreateIndex
CREATE INDEX "OvertimeRequest_requestedDate_idx" ON "OvertimeRequest"("requestedDate");

-- CreateIndex
CREATE INDEX "OvertimeRequest_clientId_idx" ON "OvertimeRequest"("clientId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_projectId_idx" ON "OvertimeRequest"("projectId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_approvedBy_idx" ON "OvertimeRequest"("approvedBy");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
