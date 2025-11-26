import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Running termination migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../prisma/migrations/20250105000000_add_expired_status_termination_reason/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute the migration SQL
    await prisma.$executeRawUnsafe(sql);
    
    console.log('✅ Successfully applied termination migration');
    console.log('✅ Added terminationReason column to Employee table');
    console.log('✅ Added EXPIRED status to EmployeeStatus enum');
    
  } catch (error: any) {
    // Check if it's a "already exists" error
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      console.log('ℹ️  Migration already applied (columns/enum values already exist)');
    } else {
      console.error('❌ Error running migration:', error);
      throw error;
    }
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










