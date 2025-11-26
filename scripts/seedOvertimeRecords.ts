import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed script to add overtime records for all employees
 * Creates attendance records with overtime for testing
 */
async function seedOvertimeRecords() {
  try {
    console.log('🌱 Starting to seed overtime records...');

    // Get all active employees
    const employees = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    console.log(`📊 Found ${employees.length} active employees`);

    if (employees.length === 0) {
      console.log('❌ No active employees found');
      return;
    }

    // Get today's date in Dubai timezone
    const now = new Date();
    const utcTime = now.getTime();
    const dubaiTime = new Date(utcTime + (4 * 60 * 60 * 1000));
    const today = new Date(Date.UTC(
      dubaiTime.getUTCFullYear(),
      dubaiTime.getUTCMonth(),
      dubaiTime.getUTCDate(),
      0, 0, 0, 0
    ));

    console.log(`📅 Today's date (Dubai): ${today.toISOString()}`);

    // Create or update attendance records with overtime for each employee
    const results = [];
    for (const employee of employees) {
      try {
        // Check if record already exists
        const existingRecord = await prisma.attendance.findUnique({
          where: {
            employeeId_date: {
              employeeId: employee.id,
              date: today,
            },
          },
        });

        if (existingRecord) {
          console.log(`⏭️  Skipping ${employee.firstName} ${employee.lastName} - record already exists`);
          continue;
        }

        // Create check-in time: 9:00 AM Dubai time
        const checkInTime = new Date(Date.UTC(
          dubaiTime.getUTCFullYear(),
          dubaiTime.getUTCMonth(),
          dubaiTime.getUTCDate(),
          5, 0, 0, 0 // 9:00 AM Dubai time (UTC+4)
        ));

        // Create check-out time: 6:30 PM Dubai time (9.5 hours)
        const checkOutTime = new Date(Date.UTC(
          dubaiTime.getUTCFullYear(),
          dubaiTime.getUTCMonth(),
          dubaiTime.getUTCDate(),
          14, 30, 0, 0 // 6:30 PM Dubai time (UTC+4)
        ));

        // Calculate hours worked: 9.5 hours
        const hoursWorked = 9.5;
        const overtime = 0.5; // 0.5 hours overtime (9.5 - 9)

        // Create attendance record
        const record = await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date: today,
            checkInTime,
            checkOutTime,
            hoursWorked: Math.round(hoursWorked * 100) / 100,
            overtime: Math.round(overtime * 100) / 100,
            notes: 'Test record with overtime',
          },
        });

        results.push({
          employee: `${employee.firstName} ${employee.lastName}`,
          hoursWorked: record.hoursWorked,
          overtime: record.overtime,
          status: '✅ Created',
        });

        console.log(`✅ Created record for ${employee.firstName} ${employee.lastName}`);
        console.log(`   Hours: ${record.hoursWorked}, Overtime: ${record.overtime}`);
      } catch (error) {
        console.error(`❌ Error creating record for ${employee.firstName} ${employee.lastName}:`, error);
        results.push({
          employee: `${employee.firstName} ${employee.lastName}`,
          status: '❌ Error',
        });
      }
    }

    console.log('\n📊 Summary:');
    console.table(results);

    console.log('\n✅ Seeding completed!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed script
seedOvertimeRecords();

