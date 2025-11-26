import { PrismaClient, OvertimeStatus } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseOvertime {
  id: string;
  employee_id: string;
  attendance_log_id: string | null;
  date: string;
  hours: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  rolled_from_period: string | null;
  roll_reason: string | null;
  pay_period: string | null;
}

function parseOvertime(): SupabaseOvertime[] {
  const filePath = path.join(__dirname, "../supabase_sqls/overtime_records_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse overtime SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseOvertime[] = [];
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
      attendance_log_id: cleanValues[2] as string | null,
      date: cleanValues[3] as string,
      hours: cleanValues[4] as string,
      status: cleanValues[5] as string,
      approved_by: cleanValues[6] as string | null,
      approved_at: cleanValues[7] as string | null,
      remarks: cleanValues[8] as string | null,
      created_at: cleanValues[9] as string,
      updated_at: cleanValues[10] as string,
      rolled_from_period: cleanValues[11] as string | null,
      roll_reason: cleanValues[12] as string | null,
      pay_period: cleanValues[13] as string | null,
    });
  }

  return records;
}

function mapOvertimeStatus(status: string): OvertimeStatus {
  const mapping: { [key: string]: OvertimeStatus } = {
    Pending: "PENDING",
    Approved: "APPROVED",
    Rejected: "REJECTED",
  };
  return mapping[status] || "PENDING";
}

async function migrateOvertime() {
  try {
    console.log("🔄 Starting overtime migration...");
    const records = parseOvertime();
    console.log(`📊 Found ${records.length} overtime records to migrate`);

    let migrated = 0;
    let skipped = 0;
    let employeeNotFound = 0;

    for (const record of records) {
      try {
        const employee = await prisma.employee.findUnique({
          where: { id: record.employee_id },
        });

        if (!employee) {
          employeeNotFound++;
          skipped++;
          continue;
        }

        const date = new Date(record.date);
        const createdAt = new Date(record.created_at);
        const updatedAt = new Date(record.updated_at);

        if (isNaN(date.getTime()) || isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())) {
          skipped++;
          if (migrated === 0 && skipped === 1) {
            console.log(`  ⚠️  Date parsing issue: date=${record.date}, created_at=${record.created_at}, updated_at=${record.updated_at}`);
          }
          continue;
        }

        const overtimeHours = parseFloat(record.hours) || 0;
        const rate = 1.25; // Default rate
        const amount = overtimeHours * rate;

        await prisma.overtime.create({
          data: {
            id: record.id,
            employeeId: record.employee_id,
            date,
            hoursWorked: 9, // Assume 9 hours regular work before overtime
            overtimeHours,
            rate,
            amount,
            status: mapOvertimeStatus(record.status),
            createdAt,
            updatedAt,
          },
        });

        migrated++;
        if (migrated % 100 === 0) console.log(`  ✅ ${migrated}/${records.length}`);
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
    console.log(`  Employee not found: ${employeeNotFound}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateOvertime();

