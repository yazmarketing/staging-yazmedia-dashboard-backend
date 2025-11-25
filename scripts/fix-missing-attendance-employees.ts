import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

/**
 * Script to find and map missing employee IDs from attendance CSV
 * This will help identify which employees need to be created or mapped
 */

interface CSVAttendanceRecord {
  employee_id: string;
  date: string;
  tasks_completed?: string;
}

const missingEmployeeIds = [
  '8490749a-0b08-45fd-bf2a-3c0139bafbab',
  '19b72739-1861-44c1-9126-32be365cd373',
];

async function findMissingEmployees() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 FINDING MISSING EMPLOYEES FROM ATTENDANCE CSV');
    console.log('='.repeat(70));

    // Read CSV file
    const csvPath = path.join(__dirname, '..', 'YAZ Media Attendance Logs (2).csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records: CSVAttendanceRecord[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    });

    console.log(`\n📊 Analyzing ${records.length} attendance records\n`);

    // Get all employees
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        employeeId: true,
        status: true,
        userStatus: true,
      },
    });

    console.log(`📊 Found ${employees.length} employees in database\n`);

    // Find records with missing employee IDs
    const missingRecords: { employee_id: string; dates: string[]; tasks: string[] }[] = [];

    for (const missingId of missingEmployeeIds) {
      const recordsForEmployee = records.filter((r) => r.employee_id === missingId);
      
      if (recordsForEmployee.length > 0) {
        const dates = recordsForEmployee.map((r) => r.date).filter((d): d is string => !!d);
        const tasks = recordsForEmployee
          .map((r) => r.tasks_completed)
          .filter((t): t is string => !!t && t.trim() !== '' && t !== '-');

        missingRecords.push({
          employee_id: missingId,
          dates: [...new Set(dates)].sort(),
          tasks: [...new Set(tasks)].slice(0, 5), // First 5 unique tasks
        });
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📋 MISSING EMPLOYEES REPORT');
    console.log('='.repeat(70));

    for (const missing of missingRecords) {
      console.log(`\n❌ Employee ID: ${missing.employee_id}`);
      console.log(`   📅 Dates with attendance: ${missing.dates.length} dates`);
      console.log(`      ${missing.dates.slice(0, 5).join(', ')}${missing.dates.length > 5 ? '...' : ''}`);
      console.log(`   📝 Sample tasks:`);
      missing.tasks.slice(0, 3).forEach((task) => {
        console.log(`      - ${task.substring(0, 60)}${task.length > 60 ? '...' : ''}`);
      });
      
      // Try to find similar employees by tasks/keywords
      const keywords = missing.tasks.join(' ').toLowerCase();
      console.log(`\n   🔍 Searching for similar employees by task keywords...`);
      
      const similar = employees.filter((emp) => {
        const empName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        const empEmail = emp.email.toLowerCase();
        return keywords.includes(empName) || keywords.includes(empEmail);
      });

      if (similar.length > 0) {
        console.log(`   ✅ Possible matches:`);
        similar.forEach((emp) => {
          console.log(`      - ${emp.firstName} ${emp.lastName} (${emp.email}) - ID: ${emp.id}`);
          console.log(`        Status: ${emp.status} / UserStatus: ${emp.userStatus}`);
        });
      } else {
        console.log(`   ⚠️  No similar employees found by keyword matching`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(70));
    console.log('\n1. Check if these employees were terminated/inactivated');
    console.log('2. Check if employee IDs changed during migration');
    console.log('3. Review the tasks/comments to identify the employees');
    console.log('4. Either:');
    console.log('   - Create new employee records if they are new employees');
    console.log('   - Map old IDs to new IDs if IDs changed');
    console.log('   - Reactivate employees if they were terminated\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

findMissingEmployees();

