import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

/**
 * Map old employee IDs to new employee IDs
 */
const employeeIdMapping: Record<string, string> = {
  '8490749a-0b08-45fd-bf2a-3c0139bafbab': '', // Adam Elgohary - will be found by name
  '19b72739-1861-44c1-9126-32be365cd373': '', // Burak Yildirim - will be found by name
};

interface CSVAttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in_time: string;
  check_out_time: string;
  total_work_hours: string;
  extra_hours: string;
  status: string;
  tasks_completed: string;
  break_start?: string;
  break_end?: string;
  total_break?: string;
}

/**
 * Convert time string (HH:mm:ss) to minutes
 */
function timeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr || timeStr.trim() === '') return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 3) return 0;
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const seconds = parseInt(parts[2]) || 0;
  return hours * 60 + minutes + seconds / 60;
}

/**
 * Parse date string to Date object (Dubai timezone)
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Parse timestamp string to Date object
 */
function parseTimestamp(timestampStr: string | null | undefined): Date | null {
  if (!timestampStr || timestampStr.trim() === '') return null;
  try {
    return new Date(timestampStr);
  } catch {
    return null;
  }
}

async function importMissingAttendance() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 IMPORT MISSING ATTENDANCE RECORDS');
    console.log('='.repeat(70));

    // Find employees by name (try multiple variations)
    let adam = await prisma.employee.findFirst({
      where: {
        firstName: { contains: 'Adam', mode: 'insensitive' },
        lastName: { contains: 'Elgohary', mode: 'insensitive' },
      },
      select: { id: true, firstName: true, lastName: true },
    });

    // Try alternative search
    if (!adam) {
      adam = await prisma.employee.findFirst({
        where: {
          OR: [
            { firstName: { contains: 'Adam', mode: 'insensitive' } },
            { lastName: { contains: 'Elgohary', mode: 'insensitive' } },
            { email: { contains: 'adam', mode: 'insensitive' } },
          ],
        },
        select: { id: true, firstName: true, lastName: true },
      });
    }

    let burak = await prisma.employee.findFirst({
      where: {
        firstName: { contains: 'Burak', mode: 'insensitive' },
        lastName: { contains: 'Yildirim', mode: 'insensitive' },
      },
      select: { id: true, firstName: true, lastName: true },
    });

    // Try alternative search
    if (!burak) {
      burak = await prisma.employee.findFirst({
        where: {
          OR: [
            { firstName: { contains: 'Burak', mode: 'insensitive' } },
            { lastName: { contains: 'Yildirim', mode: 'insensitive' } },
            { email: { contains: 'burak', mode: 'insensitive' } },
          ],
        },
        select: { id: true, firstName: true, lastName: true },
      });
    }

    // If still not found, list all employees and ask user
    if (!adam || !burak) {
      console.log('\n⚠️  Employees not found. Listing all employees for manual selection:\n');
      const allEmployees = await prisma.employee.findMany({
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: { firstName: 'asc' },
      });

      console.log('All employees in database:');
      allEmployees.forEach((emp, idx) => {
        console.log(`  ${idx + 1}. ${emp.firstName} ${emp.lastName} (${emp.email}) - ID: ${emp.id}`);
      });

      if (!adam) {
        console.error('\n❌ Adam Elgohary not found. Please check the list above or add this employee first.');
        process.exit(1);
      }

      if (!burak) {
        console.error('\n❌ Burak Yildirim not found. Please check the list above or add this employee first.');
        process.exit(1);
      }
    }

    console.log(`✅ Found employees:`);
    console.log(`   - ${adam.firstName} ${adam.lastName} (ID: ${adam.id})`);
    console.log(`   - ${burak.firstName} ${burak.lastName} (ID: ${burak.id})\n`);

    // Update mapping
    employeeIdMapping['8490749a-0b08-45fd-bf2a-3c0139bafbab'] = adam.id;
    employeeIdMapping['19b72739-1861-44c1-9126-32be365cd373'] = burak.id;

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

    console.log(`📂 Reading CSV file: ${csvPath}`);
    console.log(`✅ Parsed ${records.length} attendance records from CSV\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process only records for the missing employees
    const missingEmployeeIds = Object.keys(employeeIdMapping);
    const recordsToProcess = records.filter((r) => missingEmployeeIds.includes(r.employee_id));

    console.log(`📊 Processing ${recordsToProcess.length} records for missing employees\n`);

    for (let i = 0; i < recordsToProcess.length; i++) {
      const record = recordsToProcess[i];
      
      try {
        const newEmployeeId = employeeIdMapping[record.employee_id];
        
        if (!newEmployeeId) {
          console.log(`⚠️  Row ${i + 2}: No mapping found for employee ID ${record.employee_id}, skipping...`);
          skippedCount++;
          continue;
        }

        // Parse dates and times
        const date = parseDate(record.date);
        const checkInTime = parseTimestamp(record.check_in_time);
        const checkOutTime = parseTimestamp(record.check_out_time);
        
        if (!checkInTime) {
          console.log(`⚠️  Row ${i + 2}: No check-in time, skipping...`);
          skippedCount++;
          continue;
        }

        // Calculate break time
        let totalBreakMinutes = 0;
        let breakStartTime: Date | null = null;
        let breakEndTime: Date | null = null;

        // Parse break time
        if (record.break_start && record.break_end && record.break_start.trim() !== '' && record.break_end.trim() !== '') {
          const breakStartParts = record.break_start.trim().split(':');
          const breakEndParts = record.break_end.trim().split(':');
          
          if (breakStartParts.length >= 2 && breakEndParts.length >= 2) {
            const breakStartHour = parseInt(breakStartParts[0]) || 0;
            const breakStartMin = parseInt(breakStartParts[1]) || 0;
            const breakEndHour = parseInt(breakEndParts[0]) || 0;
            const breakEndMin = parseInt(breakEndParts[1]) || 0;
            
            const breakStartDate = new Date(date);
            breakStartDate.setUTCHours(breakStartHour, breakStartMin, 0, 0);
            
            const breakEndDate = new Date(date);
            breakEndDate.setUTCHours(breakEndHour, breakEndMin, 0, 0);
            
            if (breakEndDate <= breakStartDate) {
              breakEndDate.setUTCDate(breakEndDate.getUTCDate() + 1);
            }
            
            breakStartTime = breakStartDate;
            breakEndTime = breakEndDate;
            
            const breakDurationMs = breakEndDate.getTime() - breakStartDate.getTime();
            const breakDurationMinutes = breakDurationMs / (1000 * 60);
            
            if (record.total_break && record.total_break.trim() !== '') {
              totalBreakMinutes = timeToMinutes(record.total_break);
            } else {
              totalBreakMinutes = breakDurationMinutes;
            }
          }
        } else if (record.total_break && record.total_break.trim() !== '') {
          totalBreakMinutes = timeToMinutes(record.total_break);
        }

        // Calculate hours worked (total_work_hours minus break time in hours)
        const totalWorkHours = parseFloat(record.total_work_hours) || 0;
        const breakHours = totalBreakMinutes / 60;
        const hoursWorked = Math.max(0, totalWorkHours - breakHours);
        
        // Calculate overtime
        const extraHours = parseFloat(record.extra_hours) || 0;
        const overtime = extraHours;

        // Prepare attendance data
        const attendanceData: any = {
          employeeId: newEmployeeId,
          date,
          checkInTime,
          checkOutTime: checkOutTime || null,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          overtime: Math.round(overtime * 100) / 100,
          notes: record.tasks_completed && record.tasks_completed.trim() !== '' ? record.tasks_completed.trim() : null,
          totalBreakMinutes: Math.round(totalBreakMinutes * 100) / 100,
          isOnBreak: false,
        };

        if (breakStartTime) {
          attendanceData.breakStartTime = breakStartTime;
        }

        if (breakEndTime) {
          attendanceData.breakEndTime = breakEndTime;
        }

        // Upsert attendance (create or update if exists)
        await prisma.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: newEmployeeId,
              date,
            },
          },
          update: attendanceData,
          create: attendanceData,
        });

        successCount++;
        
        console.log(`✅ Imported record ${i + 1}/${recordsToProcess.length}: ${date.toISOString().split('T')[0]}`);
      } catch (error: any) {
        errorCount++;
        const errorMsg = `Row ${i + 2}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ IMPORT COMPLETE');
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
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importMissingAttendance();

