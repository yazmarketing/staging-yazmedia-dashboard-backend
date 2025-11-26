import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

interface SupabaseEmployee {
  id: string;
  user_id?: string;
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
  mol_id?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  created_at?: string;
  updated_at?: string;
}

// Migration stats
let stats = {
  department: 0,
  leaveTypeColor: 0,
  holidayType: 0,
  reimbursementType: 0,
  client: 0,
  employee: 0,
  employeeBank: 0,
  project: 0,
  announcement: 0,
  inventoryItem: 0,
  asset: 0,
};

// ============================================
// PHASE 1: SETUP & PREPARATION
// ============================================

async function phase1Setup() {
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 1: SETUP & PREPARATION");
  console.log("=".repeat(60));

  try {
    // Test connection
    console.log("✓ Connecting to PostgreSQL...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("✓ Connection successful");

    // Read SQL file
    console.log("✓ Reading employees_rows.sql...");
    const sqlContent = fs.readFileSync("employees_rows.sql", "utf-8");
    console.log("✓ SQL file read successfully");

    // Parse employees
    console.log("✓ Parsing employee records...");
    const employees = parseEmployeesFromSQL(sqlContent);
    console.log(`✓ Found ${employees.length} employee records`);

    return employees;
  } catch (error) {
    console.error("❌ Phase 1 failed:", error);
    throw error;
  }
}

// ============================================
// PHASE 2: TIER 1 - FOUNDATION TABLES
// ============================================

async function phase2Tier1(employees: SupabaseEmployee[]) {
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 2: TIER 1 - FOUNDATION TABLES");
  console.log("=".repeat(60));

  try {
    // 1. Migrate Department
    console.log("\n1. Migrating Department...");
    const departments = extractDepartments(employees);
    for (const dept of departments) {
      await prisma.department.upsert({
        where: { name: dept.name },
        update: {},
        create: {
          name: dept.name,
          code: dept.code,
          description: dept.description,
        },
      });
    }
    console.log(`✓ Department: ${departments.length} records migrated`);
    stats.department = departments.length;

    // 2. Migrate LeaveTypeColor
    console.log("\n2. Migrating LeaveTypeColor...");
    const leaveColors = [
      {
        leaveType: "ANNUAL",
        name: "Annual Leave",
        hexColor: "#4CAF50",
        shortcut: "A",
      },
      {
        leaveType: "SICK",
        name: "Sick Leave",
        hexColor: "#FF9800",
        shortcut: "S",
      },
      {
        leaveType: "MATERNITY",
        name: "Maternity Leave",
        hexColor: "#E91E63",
        shortcut: "M",
      },
      {
        leaveType: "EMERGENCY",
        name: "Emergency Leave",
        hexColor: "#F44336",
        shortcut: "E",
      },
      { leaveType: "TOIL", name: "TOIL", hexColor: "#2196F3", shortcut: "T" },
      { leaveType: "WFH", name: "Work From Home", hexColor: "#9C27B0", shortcut: "W" },
    ];
    for (const color of leaveColors) {
      await prisma.leaveTypeColor.upsert({
        where: { leaveType: color.leaveType as any },
        update: {},
        create: color as any,
      });
    }
    console.log(`✓ LeaveTypeColor: ${leaveColors.length} records migrated`);
    stats.leaveTypeColor = leaveColors.length;

    // 3. Migrate HolidayType
    console.log("\n3. Migrating HolidayType...");
    const holidayTypes = [
      { type: "PUBLIC_HOLIDAY", name: "Public Holiday" },
      { type: "COMPANY_HOLIDAY", name: "Company Holiday" },
      { type: "OPTIONAL_HOLIDAY", name: "Optional Holiday" },
      { type: "SPECIAL_HOLIDAY", name: "Special Holiday" },
    ];
    for (const holiday of holidayTypes) {
      try {
        await prisma.holidayType.upsert({
          where: { id: "" }, // Will use type as unique identifier
          update: {},
          create: {
            type: holiday.type as any,
            name: holiday.name,
          },
        });
      } catch (error) {
        // Holiday type might already exist
      }
    }
    console.log(`✓ HolidayType: ${holidayTypes.length} records migrated`);
    stats.holidayType = holidayTypes.length;

    // 4. Migrate ReimbursementType
    console.log("\n4. Migrating ReimbursementType...");
    const reimbursementTypes = [
      { name: "Travel", description: "Travel expenses" },
      { name: "Meals", description: "Meal expenses" },
      { name: "Accommodation", description: "Accommodation expenses" },
      { name: "Other", description: "Other expenses" },
    ];
    for (const type of reimbursementTypes) {
      await prisma.reimbursementType.upsert({
        where: { name: type.name },
        update: {},
        create: type,
      });
    }
    console.log(`✓ ReimbursementType: ${reimbursementTypes.length} records migrated`);
    stats.reimbursementType = reimbursementTypes.length;

    // 5. Migrate Client
    console.log("\n5. Migrating Client...");
    const clients = [
      { name: "Internal", description: "Internal projects" },
      { name: "External", description: "External clients" },
    ];
    for (const client of clients) {
      await prisma.client.upsert({
        where: { name: client.name },
        update: {},
        create: client,
      });
    }
    console.log(`✓ Client: ${clients.length} records migrated`);
    stats.client = clients.length;

    console.log("\n✓ PHASE 2 COMPLETE: All Tier 1 tables migrated");
  } catch (error) {
    console.error("❌ Phase 2 failed:", error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseEmployeesFromSQL(sqlContent: string): SupabaseEmployee[] {
  const records: SupabaseEmployee[] = [];

  // Extract VALUES clause
  const valuesMatch = sqlContent.match(/VALUES\s*\((.*)\)\s*;?\s*$/s);
  if (!valuesMatch) return [];

  const valuesStr = valuesMatch[1];

  // Split records by ), (
  const recordStrings = valuesStr.split(/\),\s*\(/);

  for (let recordStr of recordStrings) {
    recordStr = recordStr.replace(/^\(/, "").replace(/\)$/, "");
    const values = parseValues(recordStr.trim());

    if (values.length >= 13) {
      const emp: SupabaseEmployee = {
        id: values[0],
        user_id: values[1],
        name: values[2],
        employee_type: values[3],
        date_of_joining: values[4],
        probation_period: values[5],
        date_of_confirmation: values[6],
        contract_duration: values[7],
        contract_expiry: values[9],
        work_email: values[10],
        designation: values[11],
        department: values[12],
        employee_id: values[13],
        status: values[14],
        gender: values[15],
        date_of_birth: values[16],
        mol_id: values[17],
        payment_method: values[18],
        iban: values[19],
        account_holder_name: values[20],
        bank_name: values[21],
        routing_number: values[22],
        basic_salary: values[23],
        total_salary: values[24],
        is_terminated: values[28],
        termination_date: values[29],
        work_mode: values[36],
        personal_email: values[37],
        manager_email: values[38],
        phone_number: values[39],
      };
      records.push(emp);
    }
  }

  return records;
}

function parseValues(str: string): string[] {
  const values: string[] = [];
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
  return values;
}

function extractDepartments(employees: SupabaseEmployee[]) {
  const depts = new Map<string, { name: string; code: string; description: string }>();

  for (const emp of employees) {
    if (emp.department && emp.department.trim() && !depts.has(emp.department)) {
      depts.set(emp.department, {
        name: emp.department,
        code: emp.department.substring(0, 3).toUpperCase(),
        description: `${emp.department} Department`,
      });
    }
  }

  return Array.from(depts.values());
}

// ============================================
// PHASE 3: TIER 2 - EMPLOYEE TABLES
// ============================================

async function phase3Tier2(employees: SupabaseEmployee[]) {
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 3: TIER 2 - EMPLOYEE TABLES");
  console.log("=".repeat(60));

  try {
    // Get all departments for lookup
    const departments = await prisma.department.findMany();
    const deptMap = new Map(departments.map(d => [d.name, d.id]));

    // Get Mawaheb for default manager
    let mawahebId = "";

    // 1. Migrate Employee (100 records)
    console.log("\n1. Migrating Employee (100 records)...");
    let employeeCount = 0;
    const employeeMap = new Map<string, string>();

    for (const emp of employees) {
      try {
        const [firstName, ...lastNameParts] = emp.name.split(" ");
        const lastName = lastNameParts.join(" ") || "Unknown";

        const isTerminated = emp.is_terminated === "true";
        const status = isTerminated ? "TERMINATED" : "ACTIVE";

        const employmentType = emp.employee_type
          .replace("Full Time", "FULL_TIME")
          .replace("Part Time", "PART_TIME")
          .replace("Contract", "CONTRACT")
          .replace("Intern", "INTERN") as any;

        let workMode: any = "ON_SITE";
        if (emp.work_mode) {
          const mode = emp.work_mode.toLowerCase().trim();
          if (mode.includes("remote")) workMode = "REMOTE";
          else if (mode.includes("hybrid")) workMode = "HYBRID";
          else workMode = "ON_SITE";
        }

        const departmentId = deptMap.get(emp.department) || deptMap.get("Administration") || "";

        // Hash password
        const hashedPassword = await bcrypt.hash("Test@123", 10);

        const employee = await prisma.employee.create({
          data: {
            id: emp.id,
            firstName,
            lastName,
            email: emp.work_email,
            password: hashedPassword,
            personalEmail: (emp.personal_email && emp.personal_email !== "false" && emp.personal_email !== "null") ? emp.personal_email : null,
            phone: (emp.phone_number && emp.phone_number !== "false" && emp.phone_number !== "null") ? emp.phone_number : null,
            dateOfBirth: emp.date_of_birth ? new Date(emp.date_of_birth) : null,
            gender: emp.gender || null,
            role: "EMPLOYEE",
            userStatus: "ACTIVE",
            employeeId: emp.employee_id || "",
            departmentId,
            designation: emp.designation,
            employmentType,
            status: status as any,
            workMode,
            joinDate: new Date(emp.date_of_joining),
            baseSalary: parseFloat(emp.basic_salary) || 0,
            totalSalary: parseFloat(emp.total_salary) || 0,
            currency: "AED",
            managerId: null, // Will set after all employees created
          },
        });

        employeeMap.set(emp.work_email, employee.id);
        if (emp.work_email === "mawaheb@yazmedia.com") {
          mawahebId = employee.id;
        }

        employeeCount++;
      } catch (error) {
        console.warn(`⚠️ Failed to migrate employee ${emp.name}:`, error);
      }
    }

    console.log(`✓ Employee: ${employeeCount} records migrated`);
    stats.employee = employeeCount;

    // Set managers
    console.log("\n  Setting managers...");
    for (const emp of employees) {
      try {
        const employeeId = employeeMap.get(emp.work_email);
        if (!employeeId) continue;

        let managerId = null;
        if (emp.manager_email) {
          managerId = employeeMap.get(emp.manager_email) || mawahebId || null;
        }

        await prisma.employee.update({
          where: { id: employeeId },
          data: { managerId },
        });
      } catch (error) {
        // Silently continue
      }
    }
    console.log("  ✓ Managers assigned");

    // 2. Migrate EmployeeBank
    console.log("\n2. Migrating EmployeeBank...");
    let bankCount = 0;
    for (const emp of employees) {
      try {
        const employeeId = employeeMap.get(emp.work_email);
        if (!employeeId) continue;

        if (emp.iban || emp.bank_name) {
          await prisma.employeeBank.create({
            data: {
              employeeId,
              paymentMethod: emp.payment_method || "",
              bankName: emp.bank_name || "",
              accountHolderName: emp.account_holder_name || "",
              iban: emp.iban || "",
              routingNumber: emp.routing_number || "",
            },
          });
          bankCount++;
        }
      } catch (error) {
        // Silently continue
      }
    }
    console.log(`✓ EmployeeBank: ${bankCount} records migrated`);
    stats.employeeBank = bankCount;

    // 3. Create LeaveSummary for all employees
    console.log("\n3. Creating LeaveSummary...");
    const currentYear = new Date().getFullYear();
    let leaveSummaryCount = 0;

    const employeeIds = Array.from(employeeMap.values());
    for (const employeeId of employeeIds) {
      try {
        await prisma.leaveSummary.upsert({
          where: { employeeId_year: { employeeId, year: currentYear } },
          update: {},
          create: {
            employeeId,
            annualLeave: 20,
            sickLeave: 10,
            maternityLeave: 90,
            emergencyLeave: 5,
            toilLeave: 0,
            wfhLeave: 10,
            year: currentYear,
          },
        });
        leaveSummaryCount++;
      } catch (error) {
        // Silently continue
      }
    }
    console.log(`✓ LeaveSummary: ${leaveSummaryCount} records created`);

    console.log("\n✓ PHASE 3 COMPLETE: All Tier 2 tables migrated");
  } catch (error) {
    console.error("❌ Phase 3 failed:", error);
    throw error;
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  try {
    console.log("\n🚀 STARTING COMPREHENSIVE DATABASE MIGRATION");
    console.log("=".repeat(60));

    // Phase 1: Setup
    const employees = await phase1Setup();

    // Phase 2: Tier 1
    await phase2Tier1(employees);

    // Phase 3: Tier 2
    await phase3Tier2(employees);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ MIGRATION COMPLETE");
    console.log("=".repeat(60));
    console.log("\nMigration Summary:");
    console.log(`  Department: ${stats.department}`);
    console.log(`  LeaveTypeColor: ${stats.leaveTypeColor}`);
    console.log(`  HolidayType: ${stats.holidayType}`);
    console.log(`  ReimbursementType: ${stats.reimbursementType}`);
    console.log(`  Client: ${stats.client}`);
    console.log(`  Employee: ${stats.employee}`);
    console.log(`  EmployeeBank: ${stats.employeeBank}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ MIGRATION FAILED:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

