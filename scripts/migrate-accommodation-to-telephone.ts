import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateAccommodationToTelephone() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 MIGRATE ACCOMMODATION ALLOWANCE TO TELEPHONE ALLOWANCE');
    console.log('='.repeat(70));

    // Check if accommodationAllowance column exists
    const checkColumn = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Employee' 
      AND column_name = 'accommodationAllowance';
    `);

    if (!Array.isArray(checkColumn) || checkColumn.length === 0) {
      console.log('⚠️  accommodationAllowance column does not exist, checking telephoneAllowance...');
      const checkTelephone = await prisma.$queryRawUnsafe(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Employee' 
        AND column_name = 'telephoneAllowance';
      `);
      if (Array.isArray(checkTelephone) && checkTelephone.length > 0) {
        console.log('✅ telephoneAllowance already exists. Migration may have already been run.');
        return;
      }
    }

    console.log('Step 1: Renaming accommodationAllowance to telephoneAllowance in Employee table...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        -- Rename column in Employee table
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Employee' AND column_name = 'accommodationAllowance'
        ) THEN
          ALTER TABLE "Employee" RENAME COLUMN "accommodationAllowance" TO "telephoneAllowance";
        END IF;
      END $$;
    `);
    console.log('✅ Employee table updated');

    console.log('\nStep 2: Updating SalaryChange table columns...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        -- Rename oldAccommodationAllowance to oldTelephoneAllowance
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'SalaryChange' AND column_name = 'oldAccommodationAllowance'
        ) THEN
          ALTER TABLE "SalaryChange" RENAME COLUMN "oldAccommodationAllowance" TO "oldTelephoneAllowance";
        END IF;

        -- Rename newAccommodationAllowance to newTelephoneAllowance
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'SalaryChange' AND column_name = 'newAccommodationAllowance'
        ) THEN
          ALTER TABLE "SalaryChange" RENAME COLUMN "newAccommodationAllowance" TO "newTelephoneAllowance";
        END IF;
      END $$;
    `);
    console.log('✅ SalaryChange table updated');

    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(70));
    console.log('📊 Summary:');
    console.log('  ✅ Employee.accommodationAllowance → Employee.telephoneAllowance');
    console.log('  ✅ SalaryChange.oldAccommodationAllowance → SalaryChange.oldTelephoneAllowance');
    console.log('  ✅ SalaryChange.newAccommodationAllowance → SalaryChange.newTelephoneAllowance\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateAccommodationToTelephone();






