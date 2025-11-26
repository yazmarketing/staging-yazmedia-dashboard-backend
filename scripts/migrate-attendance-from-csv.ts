import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

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

async function migrateAttendanceFromCSV() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 MIGRATE ATTENDANCE FROM CSV');
    console.log('='.repeat(70));

    // Read CSV file
    const csvPath = path.join(__dirname, '..', 'YAZ Media Attendance Logs (2).csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found at: ${csvPath}`);
      process.exit(1);
    }

    console.log(`📂 Reading CSV file: ${csvPath}`);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const records: CSVAttendanceRecord[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    });

    console.log(`✅ Parsed ${records.length} attendance records from CSV\n`);

    // Get all employees to map old employee_id to new employee records
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    console.log(`📊 Found ${employees.length} employees in database\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Find employee by old employee_id
        const employee = employees.find((emp) => emp.id === record.employee_id);
        
        if (!employee) {
          console.log(`⚠️  Row ${i + 2}: Employee ID ${record.employee_id} not found, skipping...`);
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
            
            // Create dates in Dubai timezone (UTC+4, but we'll use UTC and adjust)
            const breakStartDate = new Date(date);
            breakStartDate.setUTCHours(breakStartHour, breakStartMin, 0, 0);
            
            const breakEndDate = new Date(date);
            breakEndDate.setUTCHours(breakEndHour, breakEndMin, 0, 0);
            
            // If break end is before break start, assume it's the next day (shouldn't happen normally)
            if (breakEndDate <= breakStartDate) {
              breakEndDate.setUTCDate(breakEndDate.getUTCDate() + 1);
            }
            
            breakStartTime = breakStartDate;
            breakEndTime = breakEndDate;
            
            // Calculate break duration in minutes
            const breakDurationMs = breakEndDate.getTime() - breakStartDate.getTime();
            const breakDurationMinutes = breakDurationMs / (1000 * 60);
            
            // Use total_break if provided, otherwise use calculated duration
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
          employeeId: employee.id,
          date,
          checkInTime,
          checkOutTime: checkOutTime || null,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          overtime: Math.round(overtime * 100) / 100,
          notes: record.tasks_completed && record.tasks_completed.trim() !== '' ? record.tasks_completed.trim() : null,
          totalBreakMinutes: Math.round(totalBreakMinutes * 100) / 100,
          isOnBreak: false, // Historical data, not currently on break
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
              employeeId: employee.id,
              date,
            },
          },
          update: attendanceData,
          create: attendanceData,
        });

        successCount++;
        
        if ((i + 1) % 50 === 0) {
          console.log(`✅ Processed ${i + 1}/${records.length} records...`);
        }
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

migrateAttendanceFromCSV();

