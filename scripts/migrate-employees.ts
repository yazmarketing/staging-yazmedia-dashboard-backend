import { PrismaClient, EmployeeUserStatus, EmploymentType, EmployeeStatus, WorkMode } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

interface SupabaseEmployee {
  id: string;
  user_id: string | null;
  name: string;
  employee_type: string;
  date_of_joining: string;
  probation_period: string;
  date_of_confirmation: string;
  contract_duration: string;
  work_email: string;
  designation: string;
  department: string;
  employee_id: string;
  status: string;
  gender: string;
  date_of_birth: string;
  mol_id: string | null;
  payment_method: string;
  iban: string;
  account_holder_name: string;
  bank_name: string;
  routing_number: string;
  basic_salary: string;
  total_salary: string;
  work_mode: string;
  personal_email: string | null;
  manager_email: string | null;
  phone_number: string | null;
  manager_name: string | null;
  is_terminated: string;
  termination_date: string | null;
  termination_reason: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

function parseEmployees(): SupabaseEmployee[] {
  const filePath = path.join(__dirname, "../supabase_sqls/employees_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse employees SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseEmployee[] = [];
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
      user_id: cleanValues[1] as string | null,
      name: cleanValues[2] as string,
      employee_type: cleanValues[3] as string,
      date_of_joining: cleanValues[4] as string,
      probation_period: cleanValues[5] as string,
      date_of_confirmation: cleanValues[6] as string,
      contract_duration: cleanValues[7] as string,
      work_email: cleanValues[10] as string,
      designation: cleanValues[11] as string,
      department: cleanValues[12] as string,
      employee_id: cleanValues[13] as string,
      status: cleanValues[14] as string,
      gender: cleanValues[15] as string,
      date_of_birth: cleanValues[16] as string,
      mol_id: cleanValues[17] as string | null,
      payment_method: cleanValues[18] as string,
      iban: cleanValues[19] as string,
      account_holder_name: cleanValues[20] as string,
      bank_name: cleanValues[21] as string,
      routing_number: cleanValues[22] as string,
      basic_salary: cleanValues[23] as string,
      total_salary: cleanValues[24] as string,
      work_mode: cleanValues[38] as string,
      personal_email: cleanValues[39] as string | null,
      manager_email: cleanValues[40] as string | null,
      phone_number: cleanValues[42] as string | null,
      manager_name: cleanValues[43] as string | null,
      is_terminated: cleanValues[29] as string,
      termination_date: cleanValues[30] as string | null,
      termination_reason: cleanValues[31] as string | null,
      created_at: cleanValues[25] as string,
      created_by: cleanValues[26] as string | null,
      updated_at: cleanValues[27] as string,
      updated_by: cleanValues[28] as string | null,
    });
  }

  return records;
}

function mapEmploymentType(type: string): EmploymentType {
  const mapping: { [key: string]: EmploymentType } = {
    "Full Time": "FULL_TIME",
    "Part Time": "PART_TIME",
    Contract: "CONTRACT",
    Intern: "INTERN",
  };
  return mapping[type] || "FULL_TIME";
}

function mapStatus(status: string): { status: EmployeeStatus; userStatus: EmployeeUserStatus } {
  const statusMap: { [key: string]: EmployeeStatus } = {
    Active: "ACTIVE",
    Terminated: "TERMINATED",
    Resigned: "TERMINATED",
  };
  const userStatusMap: { [key: string]: EmployeeUserStatus } = {
    Active: "ACTIVE",
    Terminated: "INACTIVE",
    Resigned: "INACTIVE",
  };
  return {
    status: statusMap[status] || "ACTIVE",
    userStatus: userStatusMap[status] || "ACTIVE",
  };
}

function mapWorkMode(mode: string): WorkMode {
  const mapping: { [key: string]: WorkMode } = {
    "on-site": "ON_SITE",
    remote: "REMOTE",
    hybrid: "HYBRID",
  };
  return mapping[mode] || "ON_SITE";
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

async function migrateEmployees() {
  try {
    console.log("🔄 Starting employee migration...");
    const employees = parseEmployees();
    console.log(`📊 Found ${employees.length} employees to migrate`);

    // Create departments first
    const departments = new Map<string, string>();
    const uniqueDepts = [...new Set(employees.map((e) => e.department).filter(Boolean))];

    console.log(`\n📁 Creating ${uniqueDepts.length} departments...`);
    for (const deptName of uniqueDepts) {
      if (!deptName || deptName.trim() === "") continue;
      try {
        const dept = await prisma.department.create({
          data: {
            name: deptName,
            code: deptName.toUpperCase().replace(/\s+/g, "_").slice(0, 20),
          },
        });
        departments.set(deptName, dept.id);
        console.log(`  ✅ ${deptName}`);
      } catch (error: any) {
        if (error.code === "P2002") {
          const existing = await prisma.department.findUnique({
            where: { name: deptName },
          });
          if (existing) departments.set(deptName, existing.id);
        }
      }
    }

    // Migrate employees
    console.log(`\n👥 Migrating ${employees.length} employees...`);
    let migrated = 0;
    let skipped = 0;

    for (const emp of employees) {
      try {
        const { firstName, lastName } = splitName(emp.name);
        const { status, userStatus } = mapStatus(emp.status);
        const deptId = departments.get(emp.department) || (await prisma.department.findFirst())?.id;

        if (!deptId) {
          console.log(`  ⚠️  Skipped ${emp.name}: No department found`);
          skipped++;
          continue;
        }

        // Generate password
        const randomPassword = randomBytes(8).toString("hex");
        const password = await bcrypt.hash(randomPassword, 10);

        const employee = await prisma.employee.create({
          data: {
            id: emp.id,
            firstName,
            lastName,
            email: emp.work_email,
            password,
            personalEmail: emp.personal_email,
            phone: emp.phone_number,
            dateOfBirth: emp.date_of_birth ? new Date(emp.date_of_birth) : null,
            gender: emp.gender,
            molId: emp.mol_id,
            role: "EMPLOYEE",
            userStatus,
            employeeId: emp.employee_id?.trim() || randomBytes(8).toString("hex"),
            departmentId: deptId,
            designation: emp.designation,
            employmentType: mapEmploymentType(emp.employee_type),
            status,
            workMode: mapWorkMode(emp.work_mode),
            joinDate: new Date(emp.date_of_joining),
            probationPeriod: emp.probation_period,
            confirmationDate: emp.date_of_confirmation ? new Date(emp.date_of_confirmation) : null,
            contractDuration: emp.contract_duration,
            contractExpiryDate: emp.date_of_joining ? new Date(emp.date_of_joining) : null,
            terminationDate: emp.termination_date ? new Date(emp.termination_date) : null,
            baseSalary: parseFloat(emp.basic_salary) || 0,
            totalSalary: parseFloat(emp.total_salary) || 0,
            currency: "AED",
            createdAt: new Date(emp.created_at),
            updatedAt: new Date(emp.updated_at),
            createdBy: emp.created_by,
            updatedBy: emp.updated_by,
          },
        });

        // Create bank details
        if (emp.iban || emp.bank_name) {
          await prisma.employeeBank.create({
            data: {
              employeeId: employee.id,
              paymentMethod: emp.payment_method || "Wire Transfer",
              bankName: emp.bank_name || "N/A",
              accountHolderName: emp.account_holder_name || "N/A",
              iban: emp.iban || "N/A",
              routingNumber: emp.routing_number || "N/A",
            },
          });
        }

        migrated++;
        if (migrated % 10 === 0) console.log(`  ✅ ${migrated}/${employees.length}`);
      } catch (error: any) {
        console.error(`  ❌ Error migrating ${emp.name}:`, error.message);
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

migrateEmployees();

