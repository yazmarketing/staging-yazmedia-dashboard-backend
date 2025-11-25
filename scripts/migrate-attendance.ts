import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseAttendance {
  id: string;
  employee_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_work_hours: string;
  extra_hours: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function parseAttendance(): SupabaseAttendance[] {
  const filePath = path.join(__dirname, "../supabase_sqls/attendance_logs_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse attendance SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseAttendance[] = [];
  const recordStrings = valuesStr.split(/\),\s*\(/);

  for (let i = 0; i < recordStrings.length; i++) {
    let recordStr = recordStrings[i];
    if (i === 0) recordStr = recordStr.replace(/^\(/, "");
    if (i === recordStrings.length - 1) recordStr = recordStr.replace(/\)$/, "");

    const values = recordStr.split(/,\s*(?=(?:[^']*'[^']*')*[^']*$)/);
    const cleanValues = values.map((v) => {
      v = v.trim();
      if (v === "null") return null;
      if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
      return v;
    });

    records.push({
      id: cleanValues[0] as string,
      employee_id: cleanValues[1] as string,
      date: cleanValues[2] as string,
      check_in_time: cleanValues[3] as string | null,
      check_out_time: cleanValues[4] as string | null,
      total_work_hours: cleanValues[5] as string,
      extra_hours: cleanValues[6] as string,
      status: cleanValues[7] as string,
      created_at: cleanValues[9] as string,
      updated_at: cleanValues[10] as string,
    });
  }

  return records;
}

async function migrateAttendance() {
  try {
    console.log("🔄 Starting attendance migration...");
    const records = parseAttendance();
    console.log(`📊 Found ${records.length} attendance records to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const record of records) {
      try {
        // Check if employee exists
        const employee = await prisma.employee.findUnique({
          where: { id: record.employee_id },
        });

        if (!employee) {
          skipped++;
          continue;
        }

        const hoursWorked = parseFloat(record.total_work_hours) || 0;
        const overtime = parseFloat(record.extra_hours) || 0;

        await prisma.attendance.create({
          data: {
            id: record.id,
            employeeId: record.employee_id,
            date: new Date(record.date),
            checkInTime: record.check_in_time ? new Date(record.check_in_time) : null,
            checkOutTime: record.check_out_time ? new Date(record.check_out_time) : null,
            hoursWorked,
            overtime,
            createdAt: new Date(record.created_at),
            updatedAt: new Date(record.updated_at),
          },
        });

        migrated++;
        if (migrated % 500 === 0) console.log(`  ✅ ${migrated}/${records.length}`);
      } catch (error: any) {
        if (error.code !== "P2002") {
          console.error(`  ❌ Error:`, error.message);
        }
        skipped++;
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped: ${skipped}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateAttendance();

