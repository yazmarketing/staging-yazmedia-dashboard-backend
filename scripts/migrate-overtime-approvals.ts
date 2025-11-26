import { PrismaClient, OvertimeApprovalAction } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseOvertimeApproval {
  id: string;
  overtime_request_id: string;
  approver_id: string;
  action: string;
  approval_date: string;
  comments: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

function parseOvertimeApprovals(): SupabaseOvertimeApproval[] {
  const filePath = path.join(__dirname, "../supabase_sqls/overtime_approvals_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse overtime approvals SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseOvertimeApproval[] = [];
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
      overtime_request_id: cleanValues[1] as string,
      approver_id: cleanValues[2] as string,
      action: cleanValues[3] as string,
      approval_date: cleanValues[4] as string,
      comments: cleanValues[5] as string,
      created_at: cleanValues[6] as string,
      created_by: cleanValues[7] as string | null,
      updated_at: cleanValues[8] as string,
      updated_by: cleanValues[9] as string | null,
    });
  }

  return records;
}

function mapApprovalAction(action: string): OvertimeApprovalAction {
  const mapping: { [key: string]: OvertimeApprovalAction } = {
    Approved: "APPROVED",
    Rejected: "REJECTED",
    Recalled: "RECALLED",
    Modified: "MODIFIED",
  };
  return mapping[action] || "APPROVED";
}

async function migrateOvertimeApprovals() {
  try {
    console.log("🔄 Starting overtime approvals migration...");
    const records = parseOvertimeApprovals();
    console.log(`📊 Found ${records.length} overtime approval records to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const record of records) {
      try {
        // Skip if approver_id is null
        if (!record.approver_id) {
          skipped++;
          continue;
        }

        const overtimeRequest = await prisma.overtimeRequest.findUnique({
          where: { id: record.overtime_request_id },
        });

        const approver = await prisma.employee.findUnique({
          where: { id: record.approver_id },
        });

        if (!overtimeRequest || !approver) {
          skipped++;
          continue;
        }

        const approvalDate = new Date(record.approval_date);
        const createdAt = new Date(record.created_at);
        const updatedAt = new Date(record.updated_at);

        if (isNaN(approvalDate.getTime()) || isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())) {
          skipped++;
          continue;
        }

        await prisma.overtimeApproval.create({
          data: {
            id: record.id,
            overtimeRequestId: record.overtime_request_id,
            approvedBy: record.approver_id,
            action: mapApprovalAction(record.action),
            approvalDate,
            comments: record.comments || "",
            createdAt,
            updatedAt,
            createdBy: record.created_by,
            updatedBy: record.updated_by,
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
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateOvertimeApprovals();

