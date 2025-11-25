import { PrismaClient, SalaryChangeType, SalaryChangeStatus } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseSalaryChange {
  id: string;
  employee_id: string;
  change_date: string;
  effective_date: string;
  previous_basic_salary: string;
  new_basic_salary: string;
  previous_total_salary: string;
  new_total_salary: string;
  change_type: string;
  reason: string;
  approved_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  workflow_status: string;
}

function parseSalaryChanges(): SupabaseSalaryChange[] {
  const filePath = path.join(__dirname, "../supabase_sqls/salary_history_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse salary changes SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseSalaryChange[] = [];
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
      change_date: cleanValues[2] as string,
      effective_date: cleanValues[3] as string,
      previous_basic_salary: cleanValues[4] as string,
      new_basic_salary: cleanValues[5] as string,
      previous_total_salary: cleanValues[6] as string,
      new_total_salary: cleanValues[7] as string,
      change_type: cleanValues[8] as string,
      reason: cleanValues[10] as string,
      approved_by: cleanValues[11] as string | null,
      created_by: cleanValues[12] as string | null,
      created_at: cleanValues[13] as string,
      updated_at: cleanValues[14] as string,
      reviewed_by: cleanValues[21] as string | null,
      reviewed_at: cleanValues[22] as string | null,
      workflow_status: cleanValues[20] as string,
    });
  }

  return records;
}

function mapSalaryChangeType(type: string): SalaryChangeType {
  const mapping: { [key: string]: SalaryChangeType } = {
    "performance_based": "PERFORMANCE",
    "contract_renewal": "CONTRACT_RENEWAL",
    "industry_standard": "INDUSTRY_STANDARD",
    "promotion": "PROMOTION",
    "increment": "INCREMENT",
    "probation_completion": "PROBATION_COMPLETION",
    "other": "INCREMENT",
  };
  return mapping[type.toLowerCase()] || "INCREMENT";
}

function mapSalaryChangeStatus(status: string): SalaryChangeStatus {
  const mapping: { [key: string]: SalaryChangeStatus } = {
    "pending": "PENDING",
    "approved": "APPROVED_BY_FINANCE",
  };
  return mapping[status.toLowerCase()] || "PENDING";
}

async function migrateSalaryChanges() {
  try {
    console.log("🔄 Starting salary changes migration...");
    const records = parseSalaryChanges();
    console.log(`📊 Found ${records.length} salary change records to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const record of records) {
      try {
        const employee = await prisma.employee.findUnique({
          where: { id: record.employee_id },
        });

        if (!employee) {
          skipped++;
          continue;
        }

        const createdAt = new Date(record.created_at);
        const updatedAt = new Date(record.updated_at);
        const effectiveDate = new Date(record.effective_date);

        if (isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime()) || isNaN(effectiveDate.getTime())) {
          skipped++;
          continue;
        }

        const oldSalary = parseFloat(record.previous_total_salary) || 0;
        const newSalary = parseFloat(record.new_total_salary) || 0;

        let approvedByHR: string | null = null;
        let approvedByHRDate: Date | null = null;
        let approvedByMgmt: string | null = null;
        let approvedByMgmtDate: Date | null = null;
        let approvedByFin: string | null = null;
        let approvedByFinDate: Date | null = null;

        // If approved, set all approvals to the reviewed_by person
        if (record.workflow_status === "approved" && record.reviewed_by) {
          approvedByHR = record.reviewed_by;
          approvedByHRDate = record.reviewed_at ? new Date(record.reviewed_at) : new Date();
          approvedByMgmt = record.reviewed_by;
          approvedByMgmtDate = record.reviewed_at ? new Date(record.reviewed_at) : new Date();
          approvedByFin = record.reviewed_by;
          approvedByFinDate = record.reviewed_at ? new Date(record.reviewed_at) : new Date();
        }

        await prisma.salaryChange.create({
          data: {
            id: record.id,
            employeeId: record.employee_id,
            oldSalary,
            newSalary,
            changeType: mapSalaryChangeType(record.change_type),
            reason: record.reason || "",
            effectiveDate,
            status: mapSalaryChangeStatus(record.workflow_status),
            approvedByHR,
            approvedByHRDate,
            approvedByMgmt,
            approvedByMgmtDate,
            approvedByFin,
            approvedByFinDate,
            createdAt,
            updatedAt,
            createdBy: record.created_by,
            updatedBy: record.reviewed_by,
          },
        });

        migrated++;
        if (migrated % 5 === 0) console.log(`  ✅ ${migrated}/${records.length}`);
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

migrateSalaryChanges();

