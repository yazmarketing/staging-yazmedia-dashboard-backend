import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const prisma = new PrismaClient();

interface PayrollRecord {
  id: string;
  employee_id: string;
  pay_period: string;
  total_adjustments: string;
  net_pay: string;
  payment_method: string;
  payment_status: string;
  remarks: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  is_locked: string;
  overtime_hours: string;
  overtime_pay: string;
  deductions_total: string;
  reimbursement_total: string;
  prorated_salary: string | null;
  period_start_date: string;
  period_end_date: string;
  bonus_total: string;
  basic_salary: string;
  total_salary: string;
  leave_deductions: string;
}

function parsePayrollRecords(sqlContent: string): PayrollRecord[] {
  const records: PayrollRecord[] = [];
  
  // Extract INSERT statement
  const insertMatch = sqlContent.match(
    /INSERT INTO "public"\."payroll_records".*?VALUES\s*(.*?)(?:;|$)/s
  );
  
  if (!insertMatch) {
    console.error("❌ Could not find INSERT statement in SQL file");
    return records;
  }

  const valuesString = insertMatch[1];
  
  // Split by rows (each row ends with ), (
  const rowMatches = valuesString.match(/\([^)]+\)(?=\s*,\s*\(|$)/g);
  
  if (!rowMatches) {
    console.error("❌ Could not parse rows from SQL file");
    return records;
  }

  rowMatches.forEach((row) => {
    try {
      // Remove outer parentheses
      const content = row.slice(1, -1);
      
      // Parse values - handle quoted strings and nulls
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      let i = 0;

      while (i < content.length) {
        const char = content[i];
        
        if (char === "'" && (i === 0 || content[i - 1] !== "\\")) {
          inQuotes = !inQuotes;
          current += char;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
        i++;
      }
      
      if (current.trim()) {
        values.push(current.trim());
      }

      // Clean values
      const cleanValues = values.map((v) => {
        if (v === "null") return null;
        if (v.startsWith("'") && v.endsWith("'")) {
          return v.slice(1, -1).replace(/\\'/g, "'");
        }
        return v;
      });

      if (cleanValues.length >= 24) {
        records.push({
          id: cleanValues[0] as string,
          employee_id: cleanValues[1] as string,
          pay_period: cleanValues[2] as string,
          total_adjustments: cleanValues[3] as string,
          net_pay: cleanValues[4] as string,
          payment_method: cleanValues[5] as string,
          payment_status: cleanValues[6] as string,
          remarks: cleanValues[7] as string | null,
          created_at: cleanValues[8] as string,
          created_by: cleanValues[9] as string | null,
          updated_at: cleanValues[10] as string,
          updated_by: cleanValues[11] as string | null,
          is_locked: cleanValues[12] as string,
          overtime_hours: cleanValues[13] as string,
          overtime_pay: cleanValues[14] as string,
          deductions_total: cleanValues[15] as string,
          reimbursement_total: cleanValues[16] as string,
          prorated_salary: cleanValues[17] as string | null,
          period_start_date: cleanValues[18] as string,
          period_end_date: cleanValues[19] as string,
          bonus_total: cleanValues[20] as string,
          basic_salary: cleanValues[21] as string,
          total_salary: cleanValues[22] as string,
          leave_deductions: cleanValues[23] as string,
        });
      }
    } catch (error) {
      console.warn("⚠️  Skipped malformed row:", error);
    }
  });

  return records;
}

async function migratePayrollData() {
  try {
    console.log("\n" + "=".repeat(70));
    console.log("🚀 PAYROLL DATA MIGRATION - SUPABASE TO POSTGRESQL");
    console.log("=".repeat(70));

    // Read SQL file
    const sqlFilePath = path.join(
      process.cwd(),
      "supabase_sqls/finance_supabase.sql"
    );

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL file not found at: ${sqlFilePath}`);
    }

    console.log(`\n📂 Reading SQL file: ${sqlFilePath}`);
    const sqlContent = fs.readFileSync(sqlFilePath, "utf-8");
    console.log("✅ SQL file read successfully");

    // Parse records
    console.log("\n📊 Parsing payroll records...");
    const records = parsePayrollRecords(sqlContent);
    console.log(`✅ Found ${records.length} payroll records to migrate`);

    if (records.length === 0) {
      throw new Error("No payroll records found in SQL file");
    }

    // Test database connection
    console.log("\n🔗 Testing database connection...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Database connection successful");

    // Insert records
    console.log("\n💾 Inserting payroll records...");
    let successCount = 0;
    let errorCount = 0;

    for (const record of records) {
      try {
        // Parse pay period (format: YYYY-MM-DD)
        const payPeriodDate = new Date(record.pay_period);
        const month = payPeriodDate.getMonth() + 1;
        const year = payPeriodDate.getFullYear();

        // Map payment status to PayrollStatus enum
        let status = "PENDING";
        if (record.payment_status.toLowerCase() === "paid") {
          status = "PAID";
        } else if (record.payment_status.toLowerCase() === "rejected") {
          status = "REJECTED";
        } else if (record.payment_status.toLowerCase() === "pending approval") {
          status = "PENDING";
        } else if (record.payment_status.toLowerCase() === "on hold") {
          status = "PENDING";
        }

        await prisma.payroll.upsert({
          where: {
            employeeId_month_year: {
              employeeId: record.employee_id,
              month: month,
              year: year,
            },
          },
          update: {
            baseSalary: parseFloat(record.basic_salary),
            totalSalary: parseFloat(record.total_salary),
            deductions: parseFloat(record.deductions_total),
            netSalary: parseFloat(record.net_pay),
            status: status as any,
            updatedAt: new Date(record.updated_at),
            updatedBy: record.updated_by,
          },
          create: {
            employeeId: record.employee_id,
            month: month,
            year: year,
            baseSalary: parseFloat(record.basic_salary),
            totalSalary: parseFloat(record.total_salary),
            deductions: parseFloat(record.deductions_total),
            netSalary: parseFloat(record.net_pay),
            status: status as any,
            createdAt: new Date(record.created_at),
            updatedAt: new Date(record.updated_at),
            createdBy: record.created_by,
            updatedBy: record.updated_by,
          },
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.warn(`⚠️  Failed to insert record ${record.id}:`, error);
      }
    }

    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("📈 MIGRATION SUMMARY");
    console.log("=".repeat(70));
    console.log(`✅ Successfully migrated: ${successCount} records`);
    console.log(`❌ Failed: ${errorCount} records`);
    console.log(`📊 Total: ${records.length} records`);
    console.log("=".repeat(70));

    if (successCount > 0) {
      console.log("\n🎉 Payroll data migration completed successfully!");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migratePayrollData();

