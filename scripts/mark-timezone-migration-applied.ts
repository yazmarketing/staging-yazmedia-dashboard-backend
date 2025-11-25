import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

async function markMigrationApplied() {
  try {
    console.log('\n🚀 Marking timezone migration as applied...');
    console.log('='.repeat(60));

    // Check if the column already exists
    const columnExists = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Employee' 
      AND column_name = 'timezone'
    `;

    if (columnExists.length === 0) {
      console.log('❌ Timezone column does not exist. Please run the migration first.');
      process.exit(1);
    }

    console.log('✅ Timezone column exists in database');

    // Insert migration record into _prisma_migrations table
    const migrationName = '20251111000000_add_timezone_to_employee';

    try {
      await prisma.$executeRaw`
        INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
        VALUES (gen_random_uuid(), '', NOW(), ${migrationName}, NULL, NOW(), 1)
        ON CONFLICT (migration_name) DO NOTHING
      `;
      console.log(`✅ Migration ${migrationName} marked as applied`);
    } catch (error: any) {
      // If the migration is already recorded, that's fine
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        console.log(`ℹ️  Migration ${migrationName} is already marked as applied`);
      } else {
        throw error;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS: Migration marked as applied!');
    console.log('='.repeat(60));
    console.log('\nThe migration has been recorded in Prisma\'s migration history.');
    console.log('You can now use `prisma migrate dev` for future migrations.\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
markMigrationApplied()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

