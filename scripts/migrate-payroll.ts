import { PrismaClient, PayrollStatus } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabasePayroll {
  id: string; // 0
  employee_id: string; // 1
  pay_period: string; // 2
  total_adjustments: string; // 3
  net_pay: string; // 4
  payment_method: string; // 5
  payment_status: string; // 6
  remarks: string; // 7
  created_at: string; // 8
  created_by: string | null; // 9
  updated_at: string; // 10
  updated_by: string | null; // 11
  is_locked: string; // 12
  overtime_hours: string; // 13
  overtime_pay: string; // 14
  deductions_total: string; // 15
  reimbursement_total: string; // 16
  prorated_salary: string; // 17
  period_start_date: string; // 18
  period_end_date: string; // 19
  bonus_total: string; // 20
  basic_salary: string; // 21
  total_salary: string; // 22
  leave_deductions: string; // 23
}

function parsePayroll(): SupabasePayroll[] {
  const filePath = path.join(__dirname, "../supabase_sqls/payroll_records_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse payroll SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabasePayroll[] = [];
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
      pay_period: cleanValues[2] as string,
      total_adjustments: cleanValues[3] as string,
      net_pay: cleanValues[4] as string,
      payment_method: cleanValues[5] as string,
      payment_status: cleanValues[6] as string,
      remarks: cleanValues[7] as string,
      created_at: cleanValues[8] as string,
      created_by: cleanValues[9] as string | null,
      updated_at: cleanValues[10] as string,
      updated_by: cleanValues[11] as string | null,
      is_locked: cleanValues[12] as string,
      overtime_hours: cleanValues[13] as string,
      overtime_pay: cleanValues[14] as string,
      deductions_total: cleanValues[15] as string,
      reimbursement_total: cleanValues[16] as string,
      prorated_salary: cleanValues[17] as string,
      period_start_date: cleanValues[18] as string,
      period_end_date: cleanValues[19] as string,
      bonus_total: cleanValues[20] as string,
      basic_salary: cleanValues[21] as string,
      total_salary: cleanValues[22] as string,
      leave_deductions: cleanValues[23] as string,
    });
  }

  return records;
}

function mapPayrollStatus(status: string): PayrollStatus {
  const mapping: { [key: string]: PayrollStatus } = {
    Pending: "PENDING",
    Processed: "PROCESSED",
    Paid: "PAID",
    Failed: "FAILED",
  };
  return mapping[status] || "PENDING";
}

function extractMonthYear(payPeriod: string): { month: number; year: number } {
  const parts = payPeriod.split("-");
  const year = parseInt(parts[0]) || new Date().getFullYear();
  const month = parseInt(parts[1]) || new Date().getMonth() + 1;
  return { month, year };
}

async function migratePayroll() {
  try {
    console.log("🔄 Starting payroll migration...");
    const records = parsePayroll();
    console.log(`📊 Found ${records.length} payroll records to migrate`);

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

        const { month, year } = extractMonthYear(record.pay_period);
        const baseSalary = parseFloat(record.basic_salary) || employee.baseSalary;
        const totalSalary = parseFloat(record.total_salary) || employee.totalSalary;
        const netSalary = parseFloat(record.net_pay) || 0;
        const allowances =
          (parseFloat(record.overtime_pay) || 0) +
          (parseFloat(record.reimbursement_total) || 0) +
          (parseFloat(record.bonus_total) || 0);
        const deductions =
          (parseFloat(record.deductions_total) || 0) + (parseFloat(record.leave_deductions) || 0);

        // Validate dates
        const createdAt = new Date(record.created_at);
        const updatedAt = new Date(record.updated_at);

        if (isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())) {
          skipped++;
          continue;
        }

        await prisma.payroll.create({
          data: {
            id: record.id,
            employeeId: record.employee_id,
            month,
            year,
            baseSalary,
            totalSalary,
            allowances,
            deductions,
            netSalary,
            status: mapPayrollStatus(record.payment_status),
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

migratePayroll();
