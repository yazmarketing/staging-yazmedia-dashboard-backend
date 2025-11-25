-- Add totalSalary column to Payroll table
-- Set it equal to baseSalary for existing records
ALTER TABLE "Payroll" ADD COLUMN "totalSalary" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Update existing payroll records to use baseSalary as totalSalary
UPDATE "Payroll" SET "totalSalary" = "baseSalary" WHERE "totalSalary" = 0;

