import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔄 Applying salary change approval migration...\n');

    // Step 1: Add new columns
    console.log('Step 1: Adding new columns...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "approvedDate" TIMESTAMP(3);`);
    console.log('✅ New columns added\n');

    // Step 2: Migrate existing data
    console.log('Step 2: Migrating existing data...');
    await prisma.$executeRawUnsafe(`UPDATE "SalaryChange" SET "approvedBy" = "approvedByMgmt", "approvedDate" = "approvedByMgmtDate" WHERE "status" = 'APPROVED_BY_MANAGEMENT' AND "approvedByMgmt" IS NOT NULL;`);
    await prisma.$executeRawUnsafe(`UPDATE "SalaryChange" SET "approvedBy" = "approvedByFin", "approvedDate" = "approvedByFinDate" WHERE "status" = 'APPROVED_BY_FINANCE' AND "approvedByFin" IS NOT NULL;`);
    await prisma.$executeRawUnsafe(`UPDATE "SalaryChange" SET "approvedBy" = "approvedByMgmt", "approvedDate" = "approvedByMgmtDate" WHERE "status" = 'APPROVED_BY_HR' AND "approvedByMgmt" IS NOT NULL;`);
    console.log('✅ Data migrated\n');

    // Step 3: Update enum type (must be done before updating status values)
    console.log('Step 3: Updating enum type...');
    // Create new enum type
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "SalaryChangeStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    // Drop default constraint temporarily
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ALTER COLUMN "status" DROP DEFAULT;`);
    
    // Change the enum type (this converts old values to new ones in one step)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SalaryChange" ALTER COLUMN "status" TYPE "SalaryChangeStatus_new" USING (
        CASE "status"::text
          WHEN 'PENDING' THEN 'PENDING'::"SalaryChangeStatus_new"
          WHEN 'APPROVED_BY_HR' THEN 'APPROVED'::"SalaryChangeStatus_new"
          WHEN 'APPROVED_BY_MANAGEMENT' THEN 'APPROVED'::"SalaryChangeStatus_new"
          WHEN 'APPROVED_BY_FINANCE' THEN 'APPROVED'::"SalaryChangeStatus_new"
          WHEN 'REJECTED' THEN 'REJECTED'::"SalaryChangeStatus_new"
          ELSE 'PENDING'::"SalaryChangeStatus_new"
        END
      );
    `);
    
    // Restore default constraint
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"SalaryChangeStatus_new";`);
    
    // Drop old enum and rename new one
    await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "SalaryChangeStatus";`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "SalaryChangeStatus_new" RENAME TO "SalaryChangeStatus";`);
    console.log('✅ Enum type updated\n');

    // Step 4: Drop old columns
    console.log('Step 4: Dropping old columns...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" DROP COLUMN IF EXISTS "approvedByHR";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" DROP COLUMN IF EXISTS "approvedByHRDate";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" DROP COLUMN IF EXISTS "approvedByMgmt";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" DROP COLUMN IF EXISTS "approvedByMgmtDate";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" DROP COLUMN IF EXISTS "approvedByFin";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" DROP COLUMN IF EXISTS "approvedByFinDate";`);
    console.log('✅ Old columns dropped\n');

    console.log('🎉 Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

