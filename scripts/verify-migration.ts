import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("\n🔍 MIGRATION VERIFICATION REPORT");
    console.log("=".repeat(60));

    // 1. Count all records
    console.log("\n📊 RECORD COUNTS:");
    const counts = {
      department: await prisma.department.count(),
      leaveTypeColor: await prisma.leaveTypeColor.count(),
      holidayType: await prisma.holidayType.count(),
      reimbursementType: await prisma.reimbursementType.count(),
      client: await prisma.client.count(),
      employee: await prisma.employee.count(),
      employeeBank: await prisma.employeeBank.count(),
      leaveSummary: await prisma.leaveSummary.count(),
    };

    console.log(`  Department: ${counts.department}`);
    console.log(`  LeaveTypeColor: ${counts.leaveTypeColor}`);
    console.log(`  HolidayType: ${counts.holidayType}`);
    console.log(`  ReimbursementType: ${counts.reimbursementType}`);
    console.log(`  Client: ${counts.client}`);
    console.log(`  Employee: ${counts.employee}`);
    console.log(`  EmployeeBank: ${counts.employeeBank}`);
    console.log(`  LeaveSummary: ${counts.leaveSummary}`);

    // 2. Sample employees
    console.log("\n👥 SAMPLE EMPLOYEES (First 5):");
    const employees = await prisma.employee.findMany({
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        department: { select: { name: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
    });

    employees.forEach((emp, idx) => {
      console.log(`\n  ${idx + 1}. ${emp.firstName} ${emp.lastName}`);
      console.log(`     Email: ${emp.email}`);
      console.log(`     Role: ${emp.role}`);
      console.log(`     Status: ${emp.status}`);
      console.log(`     Department: ${emp.department?.name || "N/A"}`);
      console.log(`     Manager: ${emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : "N/A"}`);
    });

    // 3. Employee status breakdown
    console.log("\n📈 EMPLOYEE STATUS BREAKDOWN:");
    const activeCount = await prisma.employee.count({
      where: { status: "ACTIVE" },
    });
    const terminatedCount = await prisma.employee.count({
      where: { status: "TERMINATED" },
    });

    console.log(`  Active: ${activeCount}`);
    console.log(`  Terminated: ${terminatedCount}`);

    // 4. Department breakdown
    console.log("\n🏢 DEPARTMENTS:");
    const departments = await prisma.department.findMany({
      select: {
        name: true,
        _count: { select: { employees: true } },
      },
    });

    departments.forEach((dept) => {
      console.log(`  ${dept.name}: ${dept._count.employees} employees`);
    });

    // 5. Employment type breakdown
    console.log("\n💼 EMPLOYMENT TYPE BREAKDOWN:");
    const employmentTypes = await prisma.employee.groupBy({
      by: ["employmentType"],
      _count: true,
    });

    employmentTypes.forEach((type) => {
      console.log(`  ${type.employmentType}: ${type._count}`);
    });

    // 6. Bank details verification
    console.log("\n🏦 BANK DETAILS:");
    const bankWithIban = await prisma.employeeBank.count({
      where: { iban: { not: "" } },
    });
    const bankWithoutIban = await prisma.employeeBank.count({
      where: { iban: "" },
    });

    console.log(`  With IBAN: ${bankWithIban}`);
    console.log(`  Without IBAN: ${bankWithoutIban}`);

    // 7. Leave summary verification
    console.log("\n📅 LEAVE SUMMARY:");
    const leaveSummary = await prisma.leaveSummary.findFirst({
      select: {
        annualLeave: true,
        sickLeave: true,
        maternityLeave: true,
        emergencyLeave: true,
        toilLeave: true,
        wfhLeave: true,
      },
    });

    if (leaveSummary) {
      console.log(`  Annual Leave: ${leaveSummary.annualLeave} days`);
      console.log(`  Sick Leave: ${leaveSummary.sickLeave} days`);
      console.log(`  Maternity Leave: ${leaveSummary.maternityLeave} days`);
      console.log(`  Emergency Leave: ${leaveSummary.emergencyLeave} days`);
      console.log(`  TOIL Leave: ${leaveSummary.toilLeave} days`);
      console.log(`  WFH Leave: ${leaveSummary.wfhLeave} days`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ VERIFICATION COMPLETE");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

