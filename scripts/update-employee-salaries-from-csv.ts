import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface CSVRecord {
  id: string;
  baseSalary: string;
  totalSalary: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

function parseCSV(): CSVRecord[] {
  const csvPath = path.join(process.cwd(), 'Employee-updated.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  return parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CSVRecord[];
}

async function updateEmployeeSalaries() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 EMPLOYEE SALARY UPDATE FROM CSV');
    console.log('='.repeat(70));

    const records = parseCSV();
    console.log(`✅ Found ${records.length} employee records to update`);

    if (records.length === 0) {
      throw new Error('No employee records found in CSV file');
    }

    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful\n');

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        // Validate required fields
        if (!record.id) {
          console.log(`  ⚠️  Skipping ${i + 1}/${records.length}: Missing employee ID`);
          skippedCount++;
          continue;
        }

        const baseSalary = parseFloat(record.baseSalary);
        const totalSalary = parseFloat(record.totalSalary);

        if (isNaN(baseSalary) || isNaN(totalSalary)) {
          console.log(`  ⚠️  Skipping ${i + 1}/${records.length}: Invalid salary values for ${record.id} (base: ${record.baseSalary}, total: ${record.totalSalary})`);
          skippedCount++;
          continue;
        }

        // Check if employee exists
        const employee = await prisma.employee.findUnique({ where: { id: record.id } });
        if (!employee) {
          console.log(`  ⚠️  Skipping ${i + 1}/${records.length}: Employee ${record.id} (${record.firstName || ''} ${record.lastName || ''}) not found`);
          skippedCount++;
          continue;
        }

        // Update employee salary
        await prisma.employee.update({
          where: { id: record.id },
          data: {
            baseSalary,
            totalSalary,
          },
        });

        successCount++;
        if (successCount % 10 === 0 || i === records.length - 1) {
          console.log(`  ✅ Progress: ${i + 1}/${records.length} (${successCount} updated, ${skippedCount} skipped, ${errorCount} errors)`);
        }
      } catch (error: any) {
        errorCount++;
        if (error.code === 'P2025') {
          console.log(`  ⚠️  Skipping ${i + 1}/${records.length}: Employee ${record.id} not found`);
          skippedCount++;
          errorCount--;
        } else {
          console.error(`  ❌ Error updating record ${i + 1}/${records.length} (ID: ${record.id}):`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ UPDATE COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Successfully updated: ${successCount}`);
    console.log(`  ⏭️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📝 Total records: ${records.length}\n`);
  } catch (error) {
    console.error('\n❌ Update failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateEmployeeSalaries();






