import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateSalaryComponents() {
  try {
    console.log('🔄 Migrating salary components...\n');

    // Step 1: Add new columns to Employee table
    console.log('Step 1: Adding new columns to Employee table...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "accommodationAllowance" DOUBLE PRECISION DEFAULT 0;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "housingAllowance" DOUBLE PRECISION DEFAULT 0;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "transportationAllowance" DOUBLE PRECISION DEFAULT 0;`);
    console.log('✅ New columns added\n');

    // Step 2: Migrate existing data from old columns to new columns
    console.log('Step 2: Migrating existing data...');
    // Map old "accommodation" to "housingAllowance" (as it was described as housing)
    await prisma.$executeRawUnsafe(`UPDATE "Employee" SET "housingAllowance" = "accommodation" WHERE "accommodation" IS NOT NULL;`);
    // Keep transportation as is
    await prisma.$executeRawUnsafe(`UPDATE "Employee" SET "transportationAllowance" = "transportation" WHERE "transportation" IS NOT NULL;`);
    console.log('✅ Data migrated\n');

    // Step 3: Update totalSalary calculation for existing records
    console.log('Step 3: Recalculating totalSalary...');
    await prisma.$executeRawUnsafe(`
      UPDATE "Employee"
      SET "totalSalary" = COALESCE("baseSalary", 0) + 
                          COALESCE("accommodationAllowance", 0) + 
                          COALESCE("housingAllowance", 0) + 
                          COALESCE("transportationAllowance", 0)
      WHERE "baseSalary" IS NOT NULL;
    `);
    console.log('✅ Total salary recalculated\n');

    // Step 4: Drop old columns (be careful - only if they exist)
    console.log('Step 4: Dropping old columns...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" DROP COLUMN IF EXISTS "accommodation";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" DROP COLUMN IF EXISTS "transportation";`);
    console.log('✅ Old columns dropped\n');

    // Step 5: Update SalaryChange table structure
    console.log('Step 5: Updating SalaryChange table...');
    
    // Add new columns for old salary components
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "oldBaseSalary" DOUBLE PRECISION;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "oldAccommodationAllowance" DOUBLE PRECISION DEFAULT 0;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "oldHousingAllowance" DOUBLE PRECISION DEFAULT 0;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "oldTransportationAllowance" DOUBLE PRECISION DEFAULT 0;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "oldTotalSalary" DOUBLE PRECISION;`);
    
    // Add new columns for new salary components
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "newBaseSalary" DOUBLE PRECISION;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "newAccommodationAllowance" DOUBLE PRECISION DEFAULT 0;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "newHousingAllowance" DOUBLE PRECISION DEFAULT 0;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "newTransportationAllowance" DOUBLE PRECISION DEFAULT 0;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" ADD COLUMN IF NOT EXISTS "newTotalSalary" DOUBLE PRECISION;`);
    console.log('✅ SalaryChange columns added\n');

    // Step 6: Migrate existing SalaryChange data
    console.log('Step 6: Migrating existing SalaryChange data...');
    // For existing records, map oldSalary to oldBaseSalary and newSalary to newBaseSalary
    // Set oldTotalSalary and newTotalSalary from the old values
    await prisma.$executeRawUnsafe(`
      UPDATE "SalaryChange"
      SET 
        "oldBaseSalary" = COALESCE("oldSalary", 0),
        "oldTotalSalary" = COALESCE("oldSalary", 0),
        "newBaseSalary" = COALESCE("newSalary", 0),
        "newTotalSalary" = COALESCE("newSalary", 0)
      WHERE "oldSalary" IS NOT NULL OR "newSalary" IS NOT NULL;
    `);
    console.log('✅ SalaryChange data migrated\n');

    // Step 7: Drop old columns from SalaryChange
    console.log('Step 7: Dropping old SalaryChange columns...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" DROP COLUMN IF EXISTS "oldSalary";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalaryChange" DROP COLUMN IF EXISTS "newSalary";`);
    console.log('✅ Old SalaryChange columns dropped\n');

    console.log('🎉 Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateSalaryComponents();






