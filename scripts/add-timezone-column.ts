import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

async function addTimezoneColumn() {
  try {
    console.log('\n🚀 Adding timezone column to Employee table...');
    console.log('='.repeat(60));

    // Add the timezone column
    console.log('\n📝 Step 1: Adding timezone column...');
    await prisma.$executeRaw`
      ALTER TABLE "Employee" 
      ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'Asia/Dubai'
    `;
    console.log('✅ Timezone column added successfully');

    // Update existing employees based on country
    console.log('\n📝 Step 2: Updating timezone for existing employees...');
    await prisma.$executeRaw`
      UPDATE "Employee" 
      SET "timezone" = 'Africa/Cairo' 
      WHERE ("country" ILIKE '%egypt%' OR "country" ILIKE '%eg%') 
      AND "timezone" IS NULL
    `;
    console.log(`✅ Updated timezone for employees based on country`);

    // Verify the column exists
    console.log('\n📝 Step 3: Verifying column exists...');
    const testQuery = await prisma.$queryRaw<Array<{ timezone: string }>>`
      SELECT "timezone" FROM "Employee" LIMIT 1
    `;
    console.log('✅ Column verified successfully');
    console.log(`   Sample timezone value: ${testQuery[0]?.timezone || 'N/A'}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS: Timezone column added and configured!');
    console.log('='.repeat(60));
    console.log('\nThe timezone column has been added to the Employee table.');
    console.log('All existing employees default to "Asia/Dubai".');
    console.log('Employees with Egypt in their country field have been set to "Africa/Cairo".');
    console.log('\nThe server should now work correctly. You can restart it.\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addTimezoneColumn()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

