import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Adding terminationReason column to Employee table...');
  
  try {
    // Check if column exists
    const result = await prisma.$queryRaw<Array<{column_name: string}>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Employee' AND column_name = 'terminationReason'
    `;
    
    if (result.length > 0) {
      console.log('✅ Column terminationReason already exists');
      return;
    }
    
    // Add the column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Employee" 
      ADD COLUMN IF NOT EXISTS "terminationReason" TEXT;
    `);
    
    console.log('✅ Successfully added terminationReason column');
    
    // Check if EXPIRED status exists in enum
    const enumResult = await prisma.$queryRaw<Array<{enum_value: string}>>`
      SELECT enum_value 
      FROM pg_enum 
      WHERE enumlabel = 'EXPIRED' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EmployeeStatus')
    `;
    
    if (enumResult.length === 0) {
      console.log('🔄 Adding EXPIRED status to EmployeeStatus enum...');
      await prisma.$executeRawUnsafe(`
        ALTER TYPE "EmployeeStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
      `);
      console.log('✅ Successfully added EXPIRED status');
    } else {
      console.log('✅ EXPIRED status already exists');
    }
    
  } catch (error) {
    console.error('❌ Error adding terminationReason column:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

