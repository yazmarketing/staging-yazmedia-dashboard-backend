import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envPaths = [
  path.join(__dirname, '../.env.local'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../.env.production'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const prisma = new PrismaClient();

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, '../prisma/migrations/add_finance_item_approval_workflow/migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    const statements = sql
      .split('\n')
      .map((line) => {
        if (line.trim().startsWith('--')) return '';
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex).trim();
        }
        return line.trim();
      })
      .filter((line) => line.length > 0)
      .join('\n')
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    console.log(`📄 Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await prisma.$executeRawUnsafe(`${statement};`);
        console.log(`✅ Statement ${i + 1}/${statements.length} executed.`);
      } catch (error: any) {
        if (error.message?.includes('already exists') || error.code === '42710' || error.code === '23505') {
          console.log(`ℹ️  Statement ${i + 1} skipped (already exists).`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message || error);
          throw error;
        }
      }
    }

    console.log('✅ Finance approval migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
