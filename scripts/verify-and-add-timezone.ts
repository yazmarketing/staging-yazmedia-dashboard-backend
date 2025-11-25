import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables - try both .env and .env.local
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function verifyAndAddTimezone() {
  try {
    console.log('\n🔍 Verifying timezone column...');
    console.log('='.repeat(60));
    console.log(`Database URL: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') : 'NOT SET'}`);
    console.log('='.repeat(60));

    // Check if the column exists
    const columnCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'Employee' 
      AND column_name = 'timezone'
    `;

    if (columnCheck.length > 0) {
      console.log('✅ Timezone column already exists in database');
      
      // Verify it has data
      const sample = await prisma.$queryRaw<Array<{ timezone: string; count: number }>>`
        SELECT "timezone", COUNT(*) as count
        FROM "Employee"
        GROUP BY "timezone"
        LIMIT 5
      `;
      console.log('\n📊 Timezone distribution:');
      sample.forEach(row => {
        console.log(`   ${row.timezone}: ${row.count} employees`);
      });
    } else {
      console.log('❌ Timezone column does NOT exist. Adding it now...\n');
      
      // Add the timezone column
      console.log('📝 Step 1: Adding timezone column...');
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
      console.log('✅ Updated timezone for employees based on country');

      // Verify the column exists
      console.log('\n📝 Step 3: Verifying column exists...');
      const testQuery = await prisma.$queryRaw<Array<{ timezone: string }>>`
        SELECT "timezone" FROM "Employee" LIMIT 1
      `;
      console.log('✅ Column verified successfully');
      console.log(`   Sample timezone value: ${testQuery[0]?.timezone || 'N/A'}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS: Timezone column is ready!');
    console.log('='.repeat(60));
    console.log('\nThe server should now work correctly. You can restart it.\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
verifyAndAddTimezone()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });


