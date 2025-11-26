import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.production' });

const prisma = new PrismaClient();

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '../prisma/migrations/20250104000000_add_manufacturer_supplier_tables/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL into statements, preserving DO $$ blocks
    const statements: string[] = [];
    let currentStatement = '';
    let inDollarQuote = false;
    
    const lines = sql.split('\n');
    
    for (const line of lines) {
      currentStatement += line + '\n';
      
      // Check for DO $$ blocks
      if (line.trim().match(/^DO\s+\$\$/)) {
        inDollarQuote = true;
      } else if (line.trim().match(/^\$\$/)) {
        inDollarQuote = false;
        statements.push(currentStatement.trim());
        currentStatement = '';
      } else if (!inDollarQuote && line.trim().endsWith(';') && !line.trim().startsWith('--')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
    
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement || statement.startsWith('--')) continue;
      
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists') || 
            error.code === '42P07' || 
            error.code === '42710' ||
            error.code === 'P2002') {
          console.log(`⏭️  Skipped statement ${i + 1} (already exists)`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();

