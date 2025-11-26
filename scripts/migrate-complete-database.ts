import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

interface SupabaseEmployee {
  id: string;
  name: string;
  employee_type: string;
  date_of_joining: string;
  work_email: string;
  designation: string;
  department: string;
  employee_id: string;
  status: string;
  gender?: string;
  date_of_birth?: string;
  work_mode: string;
  personal_email?: string;
  manager_email?: string;
  phone_number?: string;
  basic_salary: string;
  total_salary: string;
  iban?: string;
  account_holder_name?: string;
  bank_name?: string;
  routing_number?: string;
  payment_method?: string;
  is_terminated: string;
  termination_date?: string;
  probation_period?: string;
  date_of_confirmation?: string;
  contract_duration?: string;
  contract_expiry?: string;
}

let stats = {
  employee: 0,
  employeeBank: 0,
  leaveSummary: 0,
  payrollRecord: 0,
  announcement: 0,
  leaveRequest: 0,
  attendance: 0,
};

function parseEmployeesFromSQL(sqlContent: string): SupabaseEmployee[] {
  const records: SupabaseEmployee[] = [];
  const valuesMatch = sqlContent.match(/VALUES\s*\((.*)\)\s*;?\s*$/s);
  if (!valuesMatch) return [];

  const valuesStr = valuesMatch[1];
  const recordStrings = valuesStr.split(/\),\s*\(/);

  for (let recordStr of recordStrings) {
    recordStr = recordStr.replace(/^\(/, "").replace(/\)$/, "");
    const values = parseValues(recordStr.trim());

    if (values.length >= 47) {
      records.push({
        id: values[0] || "",
        name: values[2] || "",
        employee_type: values[3] || "",
        date_of_joining: values[4] || "",
        probation_period: values[5] || undefined,
        date_of_confirmation: values[6] || undefined,
        contract_duration: values[7] || undefined,
        contract_expiry: values[9] || undefined,
        work_email: values[10] || "",
        designation: values[11] || "",
        department: values[12] || "",
        employee_id: values[13] || "",
        status: values[14] || "",
        gender: values[15] || undefined,
        date_of_birth: values[16] || undefined,
        payment_method: values[18] || undefined,
        iban: values[19] || undefined,
        account_holder_name: values[20] || undefined,
        bank_name: values[21] || undefined,
        routing_number: values[22] || undefined,
        basic_salary: values[23] || "0",
        total_salary: values[24] || "0",
        work_mode: values[36] || "",
        personal_email: values[37] || undefined,
        manager_email: values[38] || undefined,
        phone_number: values[39] || undefined,
        is_terminated: values[29] || "",
        termination_date: values[30] || undefined,
      });
    }
  }
  return records;
}

function parseValues(str: string): (string | null)[] {
  const values: (string | null)[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < str.length) {
    const char = str[i];
    const nextChar = str[i + 1];

    if (char === "'" && nextChar === "'") {
      current += "'";
      i += 2;
    } else if (char === "'") {
      inQuotes = !inQuotes;
      i++;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      i++;
    } else {
      current += char;
      i++;
    }
  }

  if (current) values.push(current.trim());
  return values.map((v) => {
    if (v === "NULL" || v === "null") return null;
    if (v === "true") return "true";
    if (v === "false") return "false";
    if (v === null) return null;
    return v.replace(/^'|'$/g, "");
  });
}

async function migrateEmployees(employees: SupabaseEmployee[]) {
  console.log("\n📊 MIGRATING EMPLOYEES...");

  const departmentMap = new Map<string, string>();
  const employeeMap = new Map<string, string>();

  // Create/get departments
  for (const emp of employees) {
    if (emp.department && !departmentMap.has(emp.department)) {
      const dept = await prisma.department.upsert({
        where: { name: emp.department },
        update: {},
        create: { name: emp.department, code: emp.department.substring(0, 3).toUpperCase() },
      });
      departmentMap.set(emp.department, dept.id);
    }
  }

  // Migrate employees
  for (const emp of employees) {
    const [firstName, ...lastNameParts] = emp.name.split(" ");
    const lastName = lastNameParts.join(" ") || "Unknown";

    const hashedPassword = await bcrypt.hash("Test@123", 10);
    const deptId = departmentMap.get(emp.department);

    try {
      const employee = await prisma.employee.upsert({
        where: { email: emp.work_email },
        update: {},
        create: {
          firstName,
          lastName,
          email: emp.work_email,
          password: hashedPassword,
          role: "EMPLOYEE",
          userStatus: "ACTIVE",
          designation: emp.designation,
          departmentId: deptId || "",
          employmentType: emp.employee_type.replace("Full Time", "FULL_TIME").replace("Part Time", "PART_TIME").replace("Contract", "CONTRACT").replace("Intern", "INTERN") as any,
          joinDate: new Date(emp.date_of_joining),
          dateOfBirth: emp.date_of_birth ? new Date(emp.date_of_birth) : null,
          gender: emp.gender,
          workMode: emp.work_mode?.toLowerCase().includes("remote") ? "REMOTE" : emp.work_mode?.toLowerCase().includes("hybrid") ? "HYBRID" : "ON_SITE",
          personalEmail: emp.personal_email && emp.personal_email !== "false" ? emp.personal_email : null,
          phone: emp.phone_number && emp.phone_number !== "false" ? emp.phone_number : null,
          baseSalary: parseFloat(emp.basic_salary) || 0,
          totalSalary: parseFloat(emp.total_salary) || 0,
          currency: "AED",
          employeeId: emp.employee_id + "_" + Math.random().toString(36).substr(2, 9),
        },
      });

      employeeMap.set(emp.work_email, employee.id);
      stats.employee++;
    } catch (error) {
      console.error(`Failed to migrate employee ${emp.work_email}:`, error);
    }
  }

  // Assign managers
  for (const emp of employees) {
    if (emp.manager_email) {
      const managerId = employeeMap.get(emp.manager_email);
      const empId = employeeMap.get(emp.work_email);

      if (empId && managerId) {
        await prisma.employee.update({
          where: { id: empId },
          data: { managerId },
        });
      }
    }
  }

  // Create bank details
  for (const emp of employees) {
    const empId = employeeMap.get(emp.work_email);
    if (empId) {
      await prisma.employeeBank.create({
        data: {
          employeeId: empId,
          paymentMethod: emp.payment_method || "Bank Transfer",
          bankName: emp.bank_name || "N/A",
          iban: emp.iban || "N/A",
          accountHolderName: emp.account_holder_name || "N/A",
          routingNumber: emp.routing_number || "N/A",
        },
      });
      stats.employeeBank++;
    }
  }

  console.log(`✓ Employees: ${stats.employee}`);
  console.log(`✓ Employee Bank: ${stats.employeeBank}`);
  return employeeMap;
}

async function createSampleData() {
  // NO FAKE DATA - Only real data from source
  console.log("\n📊 SKIPPING SAMPLE DATA - ONLY REAL DATA MIGRATED");
}

async function main() {
  console.log("🚀 STARTING COMPREHENSIVE DATABASE MIGRATION");
  console.log("=".repeat(60));

  try {
    const employees = parseEmployeesFromSQL(fs.readFileSync("employees_rows.sql", "utf-8"));
    console.log(`✓ Parsed ${employees.length} employees`);

    await migrateEmployees(employees);
    await createSampleData();

    console.log("\n" + "=".repeat(60));
    console.log("✅ MIGRATION COMPLETE");
    console.log("=".repeat(60));
    console.log("\nMigration Summary:");
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

