import { PrismaClient, LeaveType, LeaveStatus } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseLeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  absence_code: string;
  start_date: string;
  end_date: string;
  total_days: string;
  status: string;
  approval_by: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

function parseLeaveRequests(): SupabaseLeaveRequest[] {
  const filePath = path.join(__dirname, "../supabase_sqls/leave_requests_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse leave requests SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseLeaveRequest[] = [];
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
      leave_type: cleanValues[2] as string,
      absence_code: cleanValues[3] as string,
      start_date: cleanValues[4] as string,
      end_date: cleanValues[5] as string,
      total_days: cleanValues[6] as string,
      status: cleanValues[7] as string,
      approval_by: cleanValues[8] as string | null,
      reason: cleanValues[13] as string | null,
      created_at: cleanValues[10] as string,
      updated_at: cleanValues[11] as string,
    });
  }

  return records;
}

function mapLeaveType(type: string): LeaveType {
  const mapping: { [key: string]: LeaveType } = {
    Annual: "ANNUAL",
    Sick: "SICK",
    Maternity: "MATERNITY",
    Emergency: "EMERGENCY",
    TOIL: "TOIL",
    "Work From Home": "WFH",
  };
  return mapping[type] || "ANNUAL";
}

function mapLeaveStatus(status: string): LeaveStatus {
  const mapping: { [key: string]: LeaveStatus } = {
    Pending: "PENDING",
    Approved: "APPROVED",
    Rejected: "REJECTED",
    Cancelled: "CANCELLED",
  };
  return mapping[status] || "PENDING";
}

async function migrateLeaveRequests() {
  try {
    console.log("🔄 Starting leave requests migration...");
    const records = parseLeaveRequests();
    console.log(`📊 Found ${records.length} leave requests to migrate`);

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

        const numberOfDays = parseInt(record.total_days) || 1;

        await prisma.leaveRequest.create({
          data: {
            id: record.id,
            employeeId: record.employee_id,
            leaveType: mapLeaveType(record.leave_type),
            startDate: new Date(record.start_date),
            endDate: new Date(record.end_date),
            numberOfDays,
            reason: record.reason,
            status: mapLeaveStatus(record.status),
            approvedBy: record.approval_by,
            createdAt: new Date(record.created_at),
            updatedAt: new Date(record.updated_at),
          },
        });

        migrated++;
        if (migrated % 50 === 0) console.log(`  ✅ ${migrated}/${records.length}`);
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

migrateLeaveRequests();

