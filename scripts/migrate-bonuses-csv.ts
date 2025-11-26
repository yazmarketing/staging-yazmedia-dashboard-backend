import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface CSVRecord {
  id: string;
  employeeId: string;
  amount: string;
  reason: string;
  bonusDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  bonusTypeId: string;
}

function parseCSV(): CSVRecord[] {
  const csvPath = path.join(process.cwd(), 'Bonus-migrate.csv');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CSVRecord[];

  return records;
}

async function migrateBonuses() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 BONUS CSV MIGRATION');
    console.log('='.repeat(70));

    // Parse CSV
    console.log('\n📂 Reading CSV file...');
    const records = parseCSV();
    console.log(`✅ Found ${records.length} bonus records to migrate`);

    if (records.length === 0) {
      throw new Error('No bonus records found in CSV file');
    }

    // Test database connection
    console.log('\n🔗 Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');

    // Migrate records
    console.log('\n💾 Migrating bonus records...');
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Check if bonus already exists
        const existing = await prisma.bonus.findUnique({
          where: { id: record.id },
        });

        if (existing) {
          // Update existing bonus instead of skipping
          console.log(`  🔄 Updating ${i + 1}/${records.length}: Bonus ${record.id}`);
        }

        // Verify employee exists
        const employee = await prisma.employee.findUnique({
          where: { id: record.employeeId },
        });

        if (!employee) {
          console.log(`  ⚠️  Skipping ${i + 1}/${records.length}: Employee ${record.employeeId} not found`);
          skippedCount++;
          continue;
        }

        // Verify bonus type exists
        let bonusType = await prisma.bonusType.findUnique({
          where: { id: record.bonusTypeId },
        });

        if (!bonusType) {
          console.log(`  ⚠️  Skipping ${i + 1}/${records.length}: BonusType ${record.bonusTypeId} not found`);
          skippedCount++;
          continue;
        }

        // Parse dates
        const bonusDate = record.bonusDate ? new Date(record.bonusDate) : new Date();
        const createdAt = record.createdAt ? new Date(record.createdAt) : new Date();
        const updatedAt = record.updatedAt ? new Date(record.updatedAt) : new Date();

        // Parse amount
        const amount = parseFloat(record.amount);
        if (isNaN(amount)) {
          console.log(`  ⚠️  Skipping ${i + 1}/${records.length}: Invalid amount ${record.amount}`);
          skippedCount++;
          continue;
        }

        // Create or update bonus
        if (existing) {
          await prisma.bonus.update({
            where: { id: record.id },
            data: {
              employeeId: record.employeeId,
              bonusTypeId: record.bonusTypeId,
              amount,
              reason: record.reason,
              bonusDate,
              updatedAt,
              updatedBy: record.updatedBy && record.updatedBy !== '' ? record.updatedBy : null,
            },
          });
        } else {
          await prisma.bonus.create({
            data: {
              id: record.id,
              employeeId: record.employeeId,
              bonusTypeId: record.bonusTypeId,
              amount,
              reason: record.reason,
              bonusDate,
              createdAt,
              updatedAt,
              createdBy: record.createdBy && record.createdBy !== '' ? record.createdBy : null,
              updatedBy: record.updatedBy && record.updatedBy !== '' ? record.updatedBy : null,
            },
          });
        }

        successCount++;
        if (successCount % 5 === 0 || i === records.length - 1) {
          console.log(`  ✅ Progress: ${i + 1}/${records.length} (${successCount} migrated, ${skippedCount} skipped)`);
        }
      } catch (error: any) {
        errorCount++;
        if (error.code === 'P2002') {
          console.log(`  ⏭️  Skipping ${i + 1}/${records.length}: Duplicate entry for ${record.id}`);
          skippedCount++;
        } else {
          console.error(`  ❌ Error migrating record ${i + 1}/${records.length} (ID: ${record.id}):`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Successfully migrated: ${successCount}`);
    console.log(`  ⏭️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📝 Total records: ${records.length}\n`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateBonuses();

