import { PrismaClient, DeductionType, DeductionStatus } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseDeduction {
  id: string;
  employee_id: string;
  deduction_type: string;
  description: string;
  claim_amount: string;
  deduction_date: string;
  status: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  pay_period: string;
}

function parseDeductions(): SupabaseDeduction[] {
  const filePath = path.join(__dirname, "../supabase_sqls/deduction_requests_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse deductions SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseDeduction[] = [];
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
      deduction_type: cleanValues[2] as string,
      description: cleanValues[3] as string,
      claim_amount: cleanValues[4] as string,
      deduction_date: cleanValues[5] as string,
      status: cleanValues[7] as string,
      created_at: cleanValues[8] as string,
      created_by: cleanValues[9] as string | null,
      updated_at: cleanValues[10] as string,
      updated_by: cleanValues[11] as string | null,
      pay_period: cleanValues[12] as string,
    });
  }

  return records;
}

function mapDeductionType(type: string): DeductionType {
  const mapping: { [key: string]: DeductionType } = {
    "Absent Day": "ABSENCE",
    "Absence": "ABSENCE",
    "Loan": "LOAN",
    "Advance": "ADVANCE",
    "Disciplinary": "DISCIPLINARY",
    "Emergency Leave": "ABSENCE",
    "Others": "OTHER",
    "Other": "OTHER",
  };
  return mapping[type] || "OTHER";
}

function mapDeductionStatus(status: string): DeductionStatus {
  const mapping: { [key: string]: DeductionStatus } = {
    Pending: "PENDING",
    Approved: "APPROVED",
    Rejected: "REJECTED",
  };
  return mapping[status] || "PENDING";
}

async function migrateDeductions() {
  try {
    console.log("🔄 Starting deductions migration...");
    const records = parseDeductions();
    console.log(`📊 Found ${records.length} deduction records to migrate`);

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
        const payPeriod = new Date(record.pay_period);

        if (isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime()) || isNaN(payPeriod.getTime())) {
          skipped++;
          continue;
        }

        const month = payPeriod.getMonth() + 1;
        const year = payPeriod.getFullYear();

        await prisma.deduction.create({
          data: {
            id: record.id,
            employeeId: record.employee_id,
            amount: parseFloat(record.claim_amount) || 0,
            type: mapDeductionType(record.deduction_type),
            reason: record.description || "",
            month,
            year,
            status: mapDeductionStatus(record.status),
            createdAt,
            updatedAt,
            createdBy: record.created_by,
            updatedBy: record.updated_by,
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

migrateDeductions();

