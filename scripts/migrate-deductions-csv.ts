import { PrismaClient, DeductionStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface CSVRecord {
  id: string;
  employeeId: string;
  type: string;
  amount: string;
  reason: string;
  status: string;
  approvedBy: string | null;
  approvalDate: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  DeductionDate: string;
}

function parseCSV(): CSVRecord[] {
  const csvPath = path.join(process.cwd(), 'Deduction-migrate.csv');
  
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

function mapStatus(status: string): DeductionStatus {
  const upperStatus = status.toUpperCase();
  if (upperStatus === 'APPROVED') return 'APPROVED';
  if (upperStatus === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

async function migrateDeductions() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 DEDUCTION CSV MIGRATION');
    console.log('='.repeat(70));

    // Parse CSV
    console.log('\n📂 Reading CSV file...');
    const records = parseCSV();
    console.log(`✅ Found ${records.length} deduction records to migrate`);

    if (records.length === 0) {
      throw new Error('No deduction records found in CSV file');
    }

    // Test database connection
    console.log('\n🔗 Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');

    // Migrate records
    console.log('\n💾 Migrating deduction records...');
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Check if deduction already exists
        const existing = await prisma.deduction.findUnique({
          where: { id: record.id },
        });

        if (existing) {
          // Update existing deduction instead of skipping
          console.log(`  🔄 Updating ${i + 1}/${records.length}: Deduction ${record.id}`);
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

        // Find or create deduction type
        let deductionType = await prisma.deductionType.findFirst({
          where: {
            name: { equals: record.type.trim(), mode: 'insensitive' }
          }
        });

        if (!deductionType) {
          deductionType = await prisma.deductionType.create({
            data: {
              name: record.type.trim(),
              isActive: true,
            },
          });
          console.log(`  📝 Created new deduction type: ${record.type}`);
        }

        // Parse dates
        const deductionDate = record.DeductionDate ? new Date(record.DeductionDate) : new Date();
        const createdAt = record.createdAt ? new Date(record.createdAt) : new Date();
        const updatedAt = record.updatedAt ? new Date(record.updatedAt) : new Date();
        const approvalDate = record.approvalDate && record.approvalDate !== 'NULL' && record.approvalDate !== '' 
          ? new Date(record.approvalDate) 
          : null;

        // Parse amount
        const amount = parseFloat(record.amount);
        if (isNaN(amount)) {
          console.log(`  ⚠️  Skipping ${i + 1}/${records.length}: Invalid amount ${record.amount}`);
          skippedCount++;
          continue;
        }

        // Map status
        const status = mapStatus(record.status);
        const rejectionReason = record.rejectionReason && record.rejectionReason !== 'NULL' && record.rejectionReason !== ''
          ? record.rejectionReason
          : null;

        // Create or update deduction
        if (existing) {
          await prisma.deduction.update({
            where: { id: record.id },
            data: {
              employeeId: record.employeeId,
              deductionTypeId: deductionType.id,
              amount,
              reason: record.reason,
              deductionDate,
              status,
              approvedBy: record.approvedBy && record.approvedBy !== '' ? record.approvedBy : null,
              approvalDate,
              rejectionReason,
              updatedAt,
              updatedBy: record.updatedBy && record.updatedBy !== '' ? record.updatedBy : null,
            },
          });
        } else {
          await prisma.deduction.create({
            data: {
              id: record.id,
              employeeId: record.employeeId,
              deductionTypeId: deductionType.id,
              amount,
              reason: record.reason,
              deductionDate,
              status,
              approvedBy: record.approvedBy && record.approvedBy !== '' ? record.approvedBy : null,
              approvalDate,
              rejectionReason,
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

migrateDeductions();

