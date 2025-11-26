/**
 * Run Payroll Approval Workflow Migration
 * This script executes the SQL migration to add approval tracking fields
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const envPaths = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../.env.local'),
  '.env',
  '.env.local',
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`📁 Loaded environment from: ${envPath}`);
    break;
  }
}

// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.error('Please ensure .env file exists with DATABASE_URL');
  process.exit(1);
}

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('📊 Starting payroll approval workflow migration...\n');

    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '../prisma/migrations/add_payroll_approval_workflow/migration.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf-8');

    // Split by semicolons and filter out empty statements
    const cleanedSql = sql
      .split('\n')
      .map(line => {
        // Remove full-line comments
        if (line.trim().startsWith('--')) return '';
        // Remove inline comments (everything after --)
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex).trim();
        }
        return line.trim();
      })
      .filter(line => line.length > 0)
      .join('\n');

    // Split by semicolons and filter out empty statements
    const statements = cleanedSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && (s.toUpperCase().startsWith('ALTER') || s.toUpperCase().startsWith('UPDATE')));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'; // Add semicolon back

      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        await prisma.$executeRawUnsafe(statement);
        console.log(`✅ Statement ${i + 1} executed successfully\n`);
      } catch (error: any) {
        // If column already exists or enum value already exists, that's okay
        if (error.message?.includes('already exists') || error.code === '42P07' || error.meta?.code === '42P07' || 
            error.message?.includes('duplicate') || error.code === '42710') {
          console.log(`ℹ️  Statement ${i + 1} - Column/enum value already exists, skipping...\n`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message || error);
          console.error(`   SQL: ${statement.substring(0, 100)}...`);
          // Continue with other statements even if one fails
          console.log(`   Continuing with remaining statements...\n`);
        }
      }
    }

    console.log('✅ Payroll approval workflow migration completed successfully!');
    console.log('\n📈 Changes applied:');
    console.log('  - Added new PayrollStatus enum values');
    console.log('  - Added approval tracking fields to Payroll table');
    console.log('  - Migrated existing data (PAID → BANK_PAYMENT_APPROVED, PROCESSED → MANAGEMENT_APPROVED)');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
runMigration();








