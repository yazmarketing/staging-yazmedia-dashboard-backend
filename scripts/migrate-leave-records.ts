import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface CSVLeaveRecord {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  numberOfDays: string;
  reason?: string;
  status: string;
  approvedBy?: string;
  approvalDate?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Map leave type from CSV to enum
 */
function mapLeaveType(leaveType: string): string {
  const typeMap: Record<string, string> = {
    'Work From Home': 'WFH',
    'Work From Home ': 'WFH',
    'ANNUAL': 'ANNUAL',
    'SICK': 'SICK',
    'MATERNITY': 'MATERNITY',
    'EMERGENCY': 'EMERGENCY',
    'TOIL': 'TOIL',
    'WFH': 'WFH',
  };
  
  return typeMap[leaveType.trim()] || 'ANNUAL';
}

/**
 * Map status from CSV to enum
 */
function mapStatus(status: string): string {
  const statusUpper = status.trim().toUpperCase();
  if (['APPROVED', 'PENDING', 'REJECTED'].includes(statusUpper)) {
    return statusUpper;
  }
  return 'PENDING';
}

async function migrateLeaveRecords() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 MIGRATE LEAVE RECORDS FROM CSV');
    console.log('='.repeat(70));

    // Read CSV file
    const csvPath = path.join(__dirname, '..', 'Missing Leave Records (1).csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found at: ${csvPath}`);
      process.exit(1);
    }

    console.log(`📂 Reading CSV file: ${csvPath}`);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records: CSVLeaveRecord[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    });

    console.log(`✅ Parsed ${records.length} leave records from CSV\n`);

    // Get all employees to validate employee IDs
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const employeeMap = new Map(employees.map((emp) => [emp.id, emp]));

    console.log(`📊 Found ${employees.length} employees in database\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Skip empty rows
        if (!record.id || !record.employeeId) {
          console.log(`⚠️  Row ${i + 2}: Missing required fields, skipping...`);
          skippedCount++;
          continue;
        }

        // Validate employee exists
        const employee = employeeMap.get(record.employeeId);
        if (!employee) {
          console.log(`⚠️  Row ${i + 2}: Employee ID ${record.employeeId} not found, skipping...`);
          skippedCount++;
          continue;
        }

        // Check if leave request already exists
        const existing = await prisma.leaveRequest.findUnique({
          where: { id: record.id },
        });

        if (existing) {
          console.log(`⚠️  Row ${i + 2}: Leave request ${record.id} already exists, skipping...`);
          skippedCount++;
          continue;
        }

        // Parse dates
        const startDate = new Date(record.startDate);
        const endDate = new Date(record.endDate);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.log(`⚠️  Row ${i + 2}: Invalid dates, skipping...`);
          skippedCount++;
          continue;
        }

        // Calculate numberOfDays if not provided
        let numberOfDays = parseFloat(record.numberOfDays);
        if (!numberOfDays || isNaN(numberOfDays)) {
          // Calculate days difference
          const diffTime = endDate.getTime() - startDate.getTime();
          numberOfDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
        }

        // Map leave type and status
        const leaveType = mapLeaveType(record.leaveType);
        const status = mapStatus(record.status);

        // Prepare leave request data
        const leaveData: any = {
          id: record.id,
          employeeId: record.employeeId,
          leaveType,
          startDate,
          endDate,
          numberOfDays,
          reason: record.reason && record.reason.trim() !== '' ? record.reason.trim() : null,
          status,
          approvedBy: record.approvedBy && record.approvedBy.trim() !== '' ? record.approvedBy : null,
          approvalDate: record.approvalDate && record.approvalDate.trim() !== '' ? new Date(record.approvalDate) : null,
          rejectionReason: record.rejectionReason && record.rejectionReason.trim() !== '' ? record.rejectionReason.trim() : null,
          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date(),
          createdBy: record.createdBy && record.createdBy.trim() !== '' ? record.createdBy : null,
          updatedBy: record.updatedBy && record.updatedBy.trim() !== '' ? record.updatedBy : null,
        };

        // Create leave request
        await prisma.leaveRequest.create({
          data: leaveData,
        });

        successCount++;
        console.log(`✅ Imported: ${employee.firstName} ${employee.lastName} - ${leaveType} (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);
      } catch (error: any) {
        errorCount++;
        const errorMsg = `Row ${i + 2}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(70));
    console.log(`📊 Summary:`);
    console.log(`  ✅ Successfully imported: ${successCount}`);
    console.log(`  ⚠️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    
    if (errors.length > 0 && errors.length <= 20) {
      console.log(`\n❌ Error details:`);
      errors.forEach((err) => console.log(`  - ${err}`));
    } else if (errors.length > 20) {
      console.log(`\n❌ First 20 errors:`);
      errors.slice(0, 20).forEach((err) => console.log(`  - ${err}`));
      console.log(`  ... and ${errors.length - 20} more errors`);
    }
    
    console.log('');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateLeaveRecords();






