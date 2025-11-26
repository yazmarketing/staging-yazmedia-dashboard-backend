import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateSalaryChangeTypeEnum() {
  try {
    console.log('Updating SalaryChangeType enum...');

    // Add new enum values if they don't exist
    // PostgreSQL doesn't allow removing enum values easily, so we'll add the new ones
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        -- Add PERFORMANCE_BONUS if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'PERFORMANCE_BONUS' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SalaryChangeType')
        ) THEN
          ALTER TYPE "SalaryChangeType" ADD VALUE 'PERFORMANCE_BONUS';
        END IF;

        -- Add ADJUSTMENT if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'ADJUSTMENT' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SalaryChangeType')
        ) THEN
          ALTER TYPE "SalaryChangeType" ADD VALUE 'ADJUSTMENT';
        END IF;

        -- Add OTHER if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'OTHER' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SalaryChangeType')
        ) THEN
          ALTER TYPE "SalaryChangeType" ADD VALUE 'OTHER';
        END IF;
      END $$;
    `);

    console.log('✅ SalaryChangeType enum updated successfully');
  } catch (error) {
    console.error('❌ Error updating enum:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateSalaryChangeTypeEnum();






